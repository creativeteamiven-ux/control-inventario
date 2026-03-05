import { z } from 'zod';

const movementTypeEnum = z.enum(['CHECK_IN', 'CHECK_OUT', 'TRANSFER', 'STATUS_CHANGE']);
const deviceLocationEnum = z.enum([
  'MAIN_AUDITORIUM', 'RECORDING_STUDIO', 'STORAGE_ROOM',
  'YOUTH_ROOM', 'CHAPEL', 'ON_LOAN'
]);

export const createMovementSchema = z.object({
  deviceId: z.string().min(1, 'Equipo requerido'),
  type: movementTypeEnum,
  fromLocation: deviceLocationEnum.optional(),
  toLocation: deviceLocationEnum.optional(),
  reason: z.string().min(1, 'Razón requerida'),
});

export const movementFilterSchema = z.object({
  type: movementTypeEnum.optional(),
  userId: z.string().optional(),
  deviceId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
export type MovementFilterInput = z.infer<typeof movementFilterSchema>;
