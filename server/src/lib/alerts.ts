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
  const alerts: Alert[] = [];

  // Garantías por vencer (próximos 30 días) o ya vencidas en los últimos 30 días.
  const warrantyDevices = await prisma.device.findMany({
    where: {
      deletedAt: null,
      warrantyExpiry: { not: null, lte: soon },
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

export function alertsToHtml(alerts: Alert[]): string {
  if (alerts.length === 0) return '<p>No hay alertas pendientes. Todo en orden ✅</p>';
  const items = alerts
    .map(
      (a) =>
        `<li style="margin-bottom:8px"><strong>[${a.severity.toUpperCase()}] ${a.title}:</strong> ${a.message}</li>`
    )
    .join('');
  return `
    <div style="font-family:Arial,sans-serif">
      <h2>Resumen de alertas — The Warehouse</h2>
      <p>Tienes <strong>${alerts.length}</strong> alerta(s) pendiente(s):</p>
      <ul>${items}</ul>
      <p style="color:#888;font-size:12px">Correo automático del sistema de inventario.</p>
    </div>`;
}
