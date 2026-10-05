'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { createTask } from '@/app/dashboard/actions'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or less'),

  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or less'),
})

type FormData = z.infer<typeof formSchema>

const initialState = {
  success: false,
  message: '',
}

export function CreateTaskForm() {
  const [state, formAction, pending] = useActionState(
    createTask,
    initialState,
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  })

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Create a new task</CardTitle>
      </CardHeader>

      <CardContent>
        <form
          action={formAction}
          onSubmit={handleSubmit(() => undefined)}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="title"
              className="mb-1 block text-sm font-medium"
            >
              Title
            </label>

            <input
              id="title"
              type="text"
              placeholder="Enter task title"
              {...register('title')}
              className="w-full rounded-md border bg-background px-3 py-2"
            />

            {errors.title && (
              <p className="mt-1 text-sm text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium"
            >
              Description
            </label>

            <textarea
              id="description"
              placeholder="Enter task description"
              {...register('description')}
              className="w-full rounded-md border bg-background px-3 py-2"
              rows={3}
            />

            {errors.description && (
              <p className="mt-1 text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Creating...' : 'Create Task'}
          </button>

          {state.message && (
            <p className="text-sm">{state.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}