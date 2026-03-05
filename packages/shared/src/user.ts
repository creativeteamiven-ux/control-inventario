import { z } from 'zod';

export const userRoleEnum = z.enum(['ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER']);

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: userRoleEnum,
  permissions: z.array(z.string()).optional(),
  phone: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: userRoleEnum.optional(),
  permissions: z.array(z.string()).optional(),
  phone: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
