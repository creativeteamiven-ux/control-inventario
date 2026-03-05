import { z } from 'zod';

export const createMaintenanceSchema = z.object({
  deviceId: z.string().min(1, 'Equipo requerido'),
  type: z.string().min(1, 'Tipo requerido'), // preventivo, correctivo, calibración
  description: z.string().min(1, 'Descripción requerida'),
  cost: z.number().optional(),
  technician: z.string().optional(),
  startDate: z.union([z.string(), z.date()]),
  endDate: z.union([z.string(), z.date()]).optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED']).default('SCHEDULED'),
  notes: z.string().optional(),
});

export const updateMaintenanceSchema = createMaintenanceSchema.partial();

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>;
