'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { taskRepository } from '@/lib/repositories'

const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or less'),

  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
})
const updateTaskSchema = z.object({
  id: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or less'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  completed: z.boolean(),
})
export type CreateTaskState = {
  success: boolean
  message: string
  successCount: number
}

export async function createTask(
  _previousState: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const result = createTaskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
  })

  if (!result.success) {
    return {
      success: false,
      message: result.error.issues[0]?.message ?? 'Invalid task',
      successCount: _previousState.successCount,
    }
  }

  await taskRepository.createTask({
    title: result.data.title,
    description: result.data.description,
  })
  revalidatePath('/dashboard')

  return {
    success: true,
    message: 'Task created successfully',
    successCount: _previousState.successCount + 1,
  }
}

export async function updateTask(
  _previousState: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const result = updateTaskSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    completed: formData.get('completed') === 'true',
  })

  if (!result.success) {
    return {
      success: false,
      message: result.error.issues[0]?.message ?? 'Invalid task',
      successCount: _previousState.successCount,
    }
  }

  const task = await taskRepository.updateTask(result.data.id, {
    title: result.data.title,
    description: result.data.description,
    completed: result.data.completed,
  })

  if (!task) {
    return {
      success: false,
      message: 'Task not found',
      successCount: _previousState.successCount,
    }
  }

  revalidatePath('/dashboard')

  return {
    success: true,
    message: 'Task updated successfully',
    successCount: _previousState.successCount,
  }
}
export async function deleteTask(
  id: string,
): Promise<{ success: boolean; message: string }> {
  const result = z.string().min(1).safeParse(id)

  if (!result.success) {
    return {
      success: false,
      message: 'Invalid task ID',
    }
  }

  const deleted = await taskRepository.deleteTask(result.data)

  if (!deleted) {
    return {
      success: false,
      message: 'Task not found',
    }
  }

  revalidatePath('/dashboard')

  return {
    success: true,
    message: 'Task deleted successfully',
  }
}

export async function toggleTask(
  id: string,
): Promise<{ success: boolean; message: string }> {
  const task = await taskRepository.getTask(id)

  if (!task) {
    return {
      success: false,
      message: 'Task not found',
    }
  }

  await taskRepository.updateTask(id, {
    completed: !task.completed,
  })

  revalidatePath('/dashboard')

  return {
    success: true,
    message: task.completed
      ? 'Task marked as pending'
      : 'Task marked as completed',
  }
}
