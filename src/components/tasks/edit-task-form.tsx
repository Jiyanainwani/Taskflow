'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateTask } from '@/lib/task-queries'
import type { Task } from '@/types/task'

type EditTaskFormProps = {
  task: Task
}

const editTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000),
  completed: z.boolean(),
})

type EditTaskValues = z.infer<typeof editTaskSchema>

export function EditTaskForm({ task }: EditTaskFormProps) {
  const [open, setOpen] = useState(false)
  const mutation = useUpdateTask()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditTaskValues>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: {
      title: task.title,
      description: task.description ?? '',
      completed: task.completed,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        id: task.id,
        input: {
          title: values.title,
          description: values.description,
          status: values.completed
            ? 'done'
            : task.status === 'in-progress'
              ? 'in-progress'
              : 'todo',
        },
      })
      setOpen(false)
    } catch {
      // The mutation error is displayed in the dialog.
    }
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Edit
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update the details of your task.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`title-${task.id}`}>Title</Label>

            <Input
              id={`title-${task.id}`}
              {...register('title')}
              placeholder="Task title"
              aria-invalid={!!errors.title}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`description-${task.id}`}>
              Description
            </Label>

            <Textarea
              id={`description-${task.id}`}
              {...register('description')}
              placeholder="Task description"
              rows={4}
              aria-invalid={!!errors.description}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id={`completed-${task.id}`}
              type="checkbox"
              {...register('completed')}
              className="h-4 w-4"
            />

            <Label htmlFor={`completed-${task.id}`}>
              Mark as completed
            </Label>
          </div>

          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
