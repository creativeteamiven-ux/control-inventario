import { Router } from 'express';
import { createLoanSchema, returnLoanSchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth.js';
import { writeAudit } from '../lib/audit.js';
import { defaultStorageCode, ensureOnLoanCode } from '../lib/locations.js';

import { prisma } from '../lib/prisma.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('loans.view'), async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const items = await prisma.loanRecord.findMany({
      where,
      include: {
        device: { select: { id: true, name: true, internalCode: true, brand: true } },
      },
      orderBy: { loanDate: 'desc' },
    });
    res.json(items);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requirePermission('loans.view'), async (req, res, next) => {
  try {
    const item = await prisma.loanRecord.findUnique({
      where: { id: req.params.id },
      include: { device: true },
    });
    if (!item) throw new AppError(404, 'Préstamo no encontrado');
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.post('/', requirePermission('loans.create'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createLoanSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const device = await prisma.device.findFirst({
      where: { id: parsed.data.deviceId, deletedAt: null },
    });
    if (!device) throw new AppError(404, 'Equipo no encontrado');
    if (device.status === 'LOANED') throw new AppError(400, 'El equipo ya está en préstamo');
    const onLoanCode = await ensureOnLoanCode(prisma);
    const item = await prisma.$transaction(async (tx) => {
      const loan = await tx.loanRecord.create({
        data: {
          ...parsed.data,
          loanDate: new Date(parsed.data.loanDate as string),
          expectedReturn: new Date(parsed.data.expectedReturn as string),
          status: 'ACTIVE',
          approvedBy: req.user!.userId,
        } as Parameters<typeof tx.loanRecord.create>[0]['data'],
        include: { device: true },
      });
      await tx.device.update({
        where: { id: device.id },
        data: { status: 'LOANED', location: onLoanCode },
      });
      return loan;
    });
    await writeAudit(req, 'LoanRecord', item.id, 'CREATE', { deviceId: item.deviceId, borrowerName: item.borrowerName });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/return', requirePermission('loans.create'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = returnLoanSchema.safeParse(req.body);
    const returnDate = parsed.success && parsed.data.returnDate
      ? new Date(parsed.data.returnDate as string)
      : new Date();
    const loan = await prisma.loanRecord.findUnique({
      where: { id: req.params.id },
      include: { device: true },
    });
    if (!loan) throw new AppError(404, 'Préstamo no encontrado');
    if (loan.status === 'RETURNED') throw new AppError(400, 'El préstamo ya fue devuelto');
    const storageCode = await defaultStorageCode(prisma);
    await prisma.$transaction(async (tx) => {
      await tx.loanRecord.update({
        where: { id: loan.id },
        data: { returnDate, status: 'RETURNED', notes: parsed.success ? parsed.data.notes : undefined },
      });
      await tx.device.update({
        where: { id: loan.deviceId },
        data: { status: 'ACTIVE', location: storageCode },
      });
    });
    const updated = await prisma.loanRecord.findUnique({
      where: { id: req.params.id },
      include: { device: true },
    });
    await writeAudit(req, 'LoanRecord', loan.id, 'RETURN', { returnDate });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePermission('loans.create'), async (req: AuthRequest, res, next) => {
  try {
    const loan = await prisma.loanRecord.findUnique({ where: { id: req.params.id } });
    if (!loan) throw new AppError(404, 'Préstamo no encontrado');
    const storageCode = await defaultStorageCode(prisma);
    await prisma.$transaction(async (tx) => {
      await tx.loanRecord.delete({ where: { id: loan.id } });
      if (loan.status === 'ACTIVE') {
        await tx.device.update({
          where: { id: loan.deviceId },
          data: { status: 'ACTIVE', location: storageCode },
        });
      }
    });
    await writeAudit(req, 'LoanRecord', loan.id, 'DELETE', { deviceId: loan.deviceId, borrowerName: loan.borrowerName });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
