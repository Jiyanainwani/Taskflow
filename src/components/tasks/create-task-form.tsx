
'use client'

import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'

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
import { useCreateTask } from '@/lib/task-queries'
import { useTeams } from '@/lib/workspace-queries'
import { getCurrentUserId } from '@/lib/auth'
import type { ApiTeam } from '@/lib/teams-api'

function canCreateInTeam(team: ApiTeam, userId: string | null) {
  if (!userId) return false
  const ownerId = typeof team.owner === 'string' ? team.owner : team.owner._id
  if (ownerId === userId) return true
  return team.members.some((member) => {
    const memberId = typeof member.user === 'string' ? member.user : member.user._id
    return memberId === userId && member.role === 'member'
  })
}

const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),

  description: z
    .string()
    .trim()
    .max(2000, 'Description must be 2000 characters or less'),
  teamId: z.string(),
})

type CreateTaskFormValues = z.infer<typeof formSchema>

export function CreateTaskForm() {
  const mutation = useCreateTask()
  const teamsQuery = useTeams()
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    const id = getCurrentUserId()
    if (id) window.requestAnimationFrame(() => setUserId(id))
  }, [])
  const manageableTeams = useMemo(
    () => teamsQuery.data?.filter((team) => canCreateInTeam(team, userId)) ?? [],
    [teamsQuery.data, userId],
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
      teamId: '',
    },
  })

  const onSubmit = handleSubmit(async (data) => {
    try {
      const { teamId, ...taskData } = data
      await mutation.mutateAsync({
        ...taskData,
        ...(teamId ? { teamId } : {}),
      })
      reset()
    } catch {
      // The mutation error is displayed below the form.
    }
  })

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
        <form onSubmit={onSubmit} className="space-y-6">
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

          <div className="max-w-md space-y-2">
            <Label htmlFor="task-team">Save task to</Label>
            <select
              id="task-team"
              {...register('teamId')}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">Personal tasks</option>
              {manageableTeams.map((team) => (
                <option key={team._id} value={team._id}>Team: {team.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Team members can edit shared tasks. Viewers can read them only.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            {mutation.isError ? (
              <p
                role="alert"
                className="text-sm text-destructive"
              >
                {mutation.error.message}
              </p>
            ) : (
              mutation.isSuccess ? (
                <p role="status" className="text-sm text-emerald-500">
                  Task created successfully.
                </p>
              ) : <span />
            )}

            <Button
              type="submit"
              disabled={mutation.isPending}
              size="lg"
              className="gap-2 px-6 shadow-md"
            >
              <Plus className="h-5 w-5" />
              {mutation.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
