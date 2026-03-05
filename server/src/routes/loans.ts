import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createLoanSchema, returnLoanSchema } from '@soundvault/shared';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res, next) => {
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

router.get('/:id', async (req, res, next) => {
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

router.post('/', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createLoanSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message || 'Datos inválidos');
    const device = await prisma.device.findFirst({
      where: { id: parsed.data.deviceId, deletedAt: null },
    });
    if (!device) throw new AppError(404, 'Equipo no encontrado');
    if (device.status === 'LOANED') throw new AppError(400, 'El equipo ya está en préstamo');
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
        data: { status: 'LOANED', location: 'ON_LOAN' },
      });
      return loan;
    });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/return', requireRole('ADMIN', 'MANAGER', 'TECHNICIAN'), async (req, res, next) => {
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
    await prisma.$transaction(async (tx) => {
      await tx.loanRecord.update({
        where: { id: loan.id },
        data: { returnDate, status: 'RETURNED', notes: parsed.success ? parsed.data.notes : undefined },
      });
      await tx.device.update({
        where: { id: loan.deviceId },
        data: { status: 'ACTIVE', location: 'STORAGE_ROOM' },
      });
    });
    const updated = await prisma.loanRecord.findUnique({
      where: { id: req.params.id },
      include: { device: true },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;
