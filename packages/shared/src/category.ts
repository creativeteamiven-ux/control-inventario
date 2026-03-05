import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  slug: z.string().min(1, 'Slug requerido').regex(/^[a-z0-9-]+$/, 'Slug debe ser lowercase con guiones'),
  icon: z.string().min(1, 'Ícono requerido'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hex inválido'),
  parentId: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
