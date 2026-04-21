import * as z from 'zod';

export const messageSchema = z.object({
  id: z.uuid(),
  chatId: z.uuid(),
  senderId: z.uuid(),
  text: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Message = z.infer<typeof messageSchema>;

export type MessagePage = {
  messages: Message[];
  nextCursor: string | null;
};
