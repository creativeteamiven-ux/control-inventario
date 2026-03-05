import { z } from 'zod';

const deviceCategoryEnum = z.enum([
  'AUDIO_PA', 'RECORDING_STUDIO', 'INSTRUMENTS',
  'CABLES_ACCESSORIES', 'LIGHTING', 'MULTIMEDIA'
]);

const deviceStatusEnum = z.enum([
  'ACTIVE', 'MAINTENANCE', 'DAMAGED', 'LOST', 'RETIRED', 'LOANED'
]);

const deviceLocationEnum = z.enum([
  'MAIN_AUDITORIUM', 'RECORDING_STUDIO', 'STORAGE_ROOM',
  'YOUTH_ROOM', 'CHAPEL', 'ON_LOAN'
]);

export const createDeviceSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  brand: z.string().min(1, 'Marca requerida'),
  model: z.string().min(1, 'Modelo requerido'),
  serialNumber: z.string().optional(),
  categoryId: z.string().min(1, 'Categoría requerida'),
  status: deviceStatusEnum.default('ACTIVE'),
  location: deviceLocationEnum.default('STORAGE_ROOM'),
  purchaseDate: z.union([z.string(), z.date()]).optional(),
  purchasePrice: z.number().optional(),
  warrantyExpiry: z.union([z.string(), z.date()]).optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  observation: z.string().max(500).optional(),
  condition: z.number().min(0).max(100).default(100),
});

export const updateDeviceSchema = createDeviceSchema.partial();

export const deviceFilterSchema = z.object({
  categoryId: z.string().optional(),
  status: deviceStatusEnum.optional(),
  location: deviceLocationEnum.optional(),
  brand: z.string().optional(),
  search: z.string().optional(),
  conditionMin: z.number().min(0).max(100).optional(),
  conditionMax: z.number().min(0).max(100).optional(),
  needsReview: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type DeviceFilterInput = z.infer<typeof deviceFilterSchema>;
