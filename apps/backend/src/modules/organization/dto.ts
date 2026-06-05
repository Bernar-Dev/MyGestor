import { z } from 'zod';

export const CreateOrgBody = z.object({
  name: z.string().min(2, 'Nome muito curto').max(80),
});
export type CreateOrgBody = z.infer<typeof CreateOrgBody>;

export const PatchOrgBody = z.object({
  name: z.string().min(2).max(80).optional(),
  logo_url: z.string().url().nullable().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use #RRGGBB)').optional(),
});
export type PatchOrgBody = z.infer<typeof PatchOrgBody>;
