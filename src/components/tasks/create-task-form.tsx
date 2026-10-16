
'use client'

import { Plus } from 'lucide-react'
import { useActionState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { createTask } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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

type CreateTaskFormValues = z.infer<typeof formSchema>

const initialState = {
  success: false,
  message: '',
  successCount: 0,
}

export function CreateTaskForm() {
  const [state, formAction, pending] = useActionState(
    createTask,
    initialState,
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  })

  useEffect(() => {
    if (state.success && state.successCount > 0) {
      reset()
    }
  }, [state.successCount, state.success, reset])

  return (
    <Card className="overflow-hidden border-primary/30 bg-card shadow-lg">
      <CardHeader className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Plus className="h-6 w-6" />
          </div>

          <div>
            <CardTitle className="text-xl sm:text-2xl">
              Create a new task
            </CardTitle>

            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Add a task to your TaskFlow workspace.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 lg:p-7">
        <form
          onSubmit={handleSubmit(async (data) => {
            const formData = new FormData()
            formData.append('title', data.title)
            formData.append('description', data.description)

            await formAction(formData)
          })}
          className="space-y-6"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-semibold">
                Title <span className="text-destructive">*</span>
              </Label>

              <Input
                id="title"
                type="text"
                placeholder="Enter task title..."
                {...register('title')}
                className="h-12 bg-background/60 text-base"
                aria-invalid={!!errors.title}
              />

              {errors.title && (
                <p className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-sm font-semibold"
              >
                Description
              </Label>

              <Textarea
                id="description"
                placeholder="Enter task description (optional)..."
                {...register('description')}
                rows={3}
                className="min-h-12 resize-none bg-background/60 text-base"
                aria-invalid={!!errors.description}
              />

              {errors.description && (
                <p className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            {state.message ? (
              <p
                role="status"
                className={`text-sm ${
                  state.success
                    ? 'text-emerald-500'
                    : 'text-destructive'
                }`}
              >
                {state.message}
              </p>
            ) : (
              <span />
            )}

            <Button
              type="submit"
              disabled={pending}
              size="lg"
              className="gap-2 px-6 shadow-md"
            >
              <Plus className="h-5 w-5" />
              {pending ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
