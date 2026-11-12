import { z } from 'zod';
import { TaskPriority, TaskStatus } from '../../tasks/schemas/task.schema.js';

const TaskFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().datetime().optional(),
  teamId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
}).strict();

export const CreateAssistantTaskSchema = TaskFieldsSchema;
export const UpdateAssistantTaskSchema = TaskFieldsSchema
  .omit({ teamId: true })
  .partial()
  .extend({ taskId: z.string().regex(/^[a-f\d]{24}$/i) })
  .refine(({ taskId: _taskId, ...fields }) => Object.keys(fields).length > 0);

export const ListAssistantTasksSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  limit: z.number().int().min(1).max(20).default(10),
}).strict();

export type CreateAssistantTask = z.infer<typeof CreateAssistantTaskSchema>;
export type UpdateAssistantTask = z.infer<typeof UpdateAssistantTaskSchema>;
export type ListAssistantTasks = z.infer<typeof ListAssistantTasksSchema>;

export type WorkspaceAssistantAction =
  | { type: 'create_task'; input: CreateAssistantTask }
  | { type: 'update_task'; input: UpdateAssistantTask };
