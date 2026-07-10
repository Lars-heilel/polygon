import * as z from 'zod';

import { roleSchema, SessionResponseSchema } from '../auth';
import { fileSchema } from '../media';
import { userSearchResultSchema } from '../search';
import { userSchema } from '../user';
import { adminBanStateSchema } from './admin-ban.schema';

export const adminUserQuerySchema = z.object({
  query: z.string().trim().min(1).max(100),
});

export const adminUserListItemSchema = userSearchResultSchema.extend({
  role: roleSchema,
  ban: adminBanStateSchema,
});

export const adminUserListResponseSchema = z.array(adminUserListItemSchema);

export const adminSessionSummarySchema = z.object({
  activeCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});

export const adminAvatarHistoryItemSchema = fileSchema.omit({
  status: true,
  updatedAt: true,
});

export const adminUserDetailSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: roleSchema,
  profile: userSchema,
  oauthProviders: z.array(z.string()),
  avatarHistory: z.array(adminAvatarHistoryItemSchema),
  sessionSummary: adminSessionSummarySchema,
  ban: adminBanStateSchema,
});

export const adminSessionsResponseSchema = z.array(SessionResponseSchema);

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;
export type AdminAvatarHistoryItem = z.infer<typeof adminAvatarHistoryItemSchema>;
export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>;
export type AdminSessionSummary = z.infer<typeof adminSessionSummarySchema>;
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;
export type AdminSessionsResponse = z.infer<typeof adminSessionsResponseSchema>;
