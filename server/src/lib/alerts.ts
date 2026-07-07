/**
 * Cálculo de alertas operativas del inventario:
 *  - Garantías por vencer o vencidas
 *  - Préstamos vencidos (no devueltos a tiempo)
 *  - Mantenimientos programados/atrasados
 *  - Equipos en mala condición
 */
import { PrismaClient } from '@prisma/client';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  type: 'warranty' | 'loan_overdue' | 'maintenance' | 'low_condition';
  severity: AlertSeverity;
  title: string;
  message: string;
  link: string;
  date?: string;
}

const WARRANTY_WINDOW_DAYS = 30;
const LOW_CONDITION_THRESHOLD = 40;

export async function computeAlerts(prisma: PrismaClient): Promise<Alert[]> {
  const now = new Date();
  const soon = new Date(now.getTime() + WARRANTY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recentlyExpired = new Date(now.getTime() - WARRANTY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const alerts: Alert[] = [];

  // Garantías por vencer (próximos 30 días) o vencidas recientemente (últimos 30 días).
  // No se alerta de garantías vencidas hace mucho para evitar ruido permanente.
  const warrantyDevices = await prisma.device.findMany({
    where: {
      deletedAt: null,
      warrantyExpiry: { gte: recentlyExpired, lte: soon },
      status: { not: 'RETIRED' },
    },
    select: { id: true, name: true, internalCode: true, warrantyExpiry: true },
    take: 100,
  });
  for (const d of warrantyDevices) {
    if (!d.warrantyExpiry) continue;
    const expired = d.warrantyExpiry < now;
    alerts.push({
      id: `warranty-${d.id}`,
      type: 'warranty',
      severity: expired ? 'warning' : 'info',
      title: expired ? 'Garantía vencida' : 'Garantía por vencer',
      message: `${d.internalCode} — ${d.name}`,
      link: `/inventory/${d.id}`,
      date: d.warrantyExpiry.toISOString(),
    });
  }

  // Préstamos vencidos.
  const overdueLoans = await prisma.loanRecord.findMany({
    where: { status: 'ACTIVE', expectedReturn: { lt: now } },
    include: { device: { select: { id: true, name: true, internalCode: true } } },
    take: 100,
  });
  for (const l of overdueLoans) {
    alerts.push({
      id: `loan-${l.id}`,
      type: 'loan_overdue',
      severity: 'critical',
      title: 'Préstamo vencido',
      message: `${l.device?.internalCode ?? ''} prestado a ${l.borrowerName} venció el ${l.expectedReturn.toLocaleDateString('es-CO')}`,
      link: `/loans`,
      date: l.expectedReturn.toISOString(),
    });
  }

  // Mantenimientos programados cuya fecha de inicio ya pasó (atrasados) o en progreso.
  const dueMaintenance = await prisma.maintenance.findMany({
    where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] }, startDate: { lte: now } },
    include: { device: { select: { id: true, name: true, internalCode: true } } },
    take: 100,
  });
  for (const m of dueMaintenance) {
    alerts.push({
      id: `maint-${m.id}`,
      type: 'maintenance',
      severity: m.status === 'IN_PROGRESS' ? 'info' : 'warning',
      title: m.status === 'IN_PROGRESS' ? 'Mantenimiento en progreso' : 'Mantenimiento pendiente',
      message: `${m.device?.internalCode ?? ''} — ${m.type}`,
      link: `/maintenance`,
      date: m.startDate.toISOString(),
    });
  }

  // Equipos en mala condición.
  const lowCondition = await prisma.device.findMany({
    where: { deletedAt: null, condition: { lt: LOW_CONDITION_THRESHOLD }, status: { not: 'RETIRED' } },
    select: { id: true, name: true, internalCode: true, condition: true },
    take: 100,
  });
  for (const d of lowCondition) {
    alerts.push({
      id: `cond-${d.id}`,
      type: 'low_condition',
      severity: d.condition < 20 ? 'critical' : 'warning',
      title: 'Condición baja',
      message: `${d.internalCode} — ${d.name} (${d.condition}%)`,
      link: `/inventory/${d.id}`,
    });
  }

  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

const TYPE_LABELS: Record<Alert['type'], string> = {
  loan_overdue: 'Préstamos vencidos',
  maintenance: 'Mantenimientos pendientes',
  warranty: 'Garantías',
  low_condition: 'Condición baja',
};

const MAX_ITEMS_PER_TYPE = 10;

export function alertsToHtml(alerts: Alert[]): string {
  if (alerts.length === 0) return '<p>No hay alertas pendientes. Todo en orden ✅</p>';

  const bySeverity = {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  };

  // Agrupar por tipo para un resumen escaneable.
  const groups = new Map<Alert['type'], Alert[]>();
  for (const a of alerts) {
    const arr = groups.get(a.type) || [];
    arr.push(a);
    groups.set(a.type, arr);
  }

  const sections = Array.from(groups.entries())
    .map(([type, list]) => {
      const shown = list.slice(0, MAX_ITEMS_PER_TYPE);
      const rest = list.length - shown.length;
      const items = shown
        .map((a) => `<li style="margin-bottom:4px">${a.message}</li>`)
        .join('');
      const more = rest > 0 ? `<li style="color:#888">…y ${rest} más</li>` : '';
      return `
        <h3 style="margin:16px 0 4px">${TYPE_LABELS[type]} <span style="color:#888">(${list.length})</span></h3>
        <ul style="margin-top:0">${items}${more}</ul>`;
    })
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px">
      <h2 style="margin-bottom:4px">Resumen de alertas — The Warehouse</h2>
      <p style="margin-top:0">
        Tienes <strong>${alerts.length}</strong> alerta(s):
        <span style="color:#c0392b">🔴 ${bySeverity.critical} críticas</span> ·
        <span style="color:#d68910">🟠 ${bySeverity.warning} advertencias</span> ·
        <span style="color:#2980b9">🔵 ${bySeverity.info} info</span>
      </p>
      ${sections}
      <p style="color:#888;font-size:12px;margin-top:20px">Correo automático del sistema de inventario.</p>
    </div>`;
}
