import { z } from 'zod';

export const createLoanSchema = z.object({
  deviceId: z.string().min(1, 'Equipo requerido'),
  borrowerName: z.string().min(1, 'Nombre del prestatario requerido'),
  borrowerEmail: z.string().email().optional().or(z.literal('')),
  borrowerPhone: z.string().optional(),
  purpose: z.string().min(1, 'Propósito requerido'),
  loanDate: z.union([z.string(), z.date()]),
  expectedReturn: z.union([z.string(), z.date()]),
  notes: z.string().optional(),
});

export const returnLoanSchema = z.object({
  returnDate: z.union([z.string(), z.date()]).optional(),
  notes: z.string().optional(),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type ReturnLoanInput = z.infer<typeof returnLoanSchema>;
