import { z } from 'zod';

export const CreateClientBody = z.object({
  name: z.string().min(2).max(120),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().max(40).optional().or(z.literal('')),
  company: z.string().max(120).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
export type CreateClientBody = z.infer<typeof CreateClientBody>;

export const PatchClientBody = z.object({
  name: z.string().min(2).max(120).optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().max(40).nullable().optional(),
  company: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
  portal_enabled: z.boolean().optional(),
});
export type PatchClientBody = z.infer<typeof PatchClientBody>;

export const Permissions = z
  .object({
    view_campaigns: z.boolean().optional(),
    view_insights: z.boolean().optional(),
    view_creatives: z.boolean().optional(),
    view_budget: z.boolean().optional(),
    view_audiences: z.boolean().optional(),
  })
  .default({
    view_campaigns: true,
    view_insights: true,
    view_creatives: true,
    view_budget: false,
    view_audiences: false,
  });

export const AssignAccountBody = z.object({
  ad_account_id: z
    .string()
    .regex(/^act_\d+$/, "ad_account_id deve começar com 'act_'"),
  ad_account_name: z.string().optional(),
  currency: z.string().max(8).optional(),
  permissions: Permissions.optional(),
});
export type AssignAccountBody = z.infer<typeof AssignAccountBody>;

export const PatchPermissionsBody = z.object({
  ad_account_id: z.string(),
  permissions: Permissions,
});
export type PatchPermissionsBody = z.infer<typeof PatchPermissionsBody>;

export const InviteBody = z.object({
  email: z.string().email('Email inválido'),
});
export type InviteBody = z.infer<typeof InviteBody>;
