import { z } from 'zod';

export const putPhotoBodySchema = z.object({
  image: z.string().trim().min(1),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export type PutPhotoBody = z.infer<typeof putPhotoBodySchema>;
