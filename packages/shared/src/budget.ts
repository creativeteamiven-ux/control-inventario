import { z } from 'zod';
import { expenseCategoryEnum, expenseCurrencyEnum } from './expense';

export const createBudgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12).optional().nullable(),
  category: expenseCategoryEnum.optional().nullable(),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  currency: expenseCurrencyEnum.default('COP'),
  note: z.string().optional().nullable(),
});

export const updateBudgetSchema = createBudgetSchema.partial();

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
