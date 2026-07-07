import { z } from 'zod';

export const linkPreviewSchema = z.object({
  url: z.string().url(),
  canonicalUrl: z.string().url().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  siteName: z.string().nullable(),
  hostname: z.string(),
});

export type LinkPreview = z.infer<typeof linkPreviewSchema>;
