import { z } from 'zod';

export const MagicTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(''),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const MagicTasksSchema = z.array(MagicTaskSchema).max(12);

export type MagicTaskDraft = z.infer<typeof MagicTaskSchema>;
