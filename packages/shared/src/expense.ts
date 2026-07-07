import { z } from 'zod';

export const expenseCategoryEnum = z.enum([
  'PURCHASE',
  'REPAIR',
  'MAINTENANCE',
  'ACCESSORY',
  'RENTAL',
  'SERVICE',
  'OTHER',
]);

export const expenseCurrencyEnum = z.enum(['COP', 'USD']);

export const createExpenseSchema = z.object({
  date: z.union([z.string(), z.date()]),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  currency: expenseCurrencyEnum.default('COP'),
  category: expenseCategoryEnum.default('OTHER'),
  description: z.string().min(1, 'Descripción requerida'),
  supplier: z.string().optional(),
  invoiceNumber: z.string().optional(),
  paymentMethod: z.string().optional(),
  deviceId: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
