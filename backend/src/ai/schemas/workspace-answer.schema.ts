import { z } from 'zod';

export const WorkspaceAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(4000),
  citationIds: z.array(z.string().regex(/^S\d+$/)).max(8),
}).strict();

export type WorkspaceAnswer = z.infer<typeof WorkspaceAnswerSchema>;
