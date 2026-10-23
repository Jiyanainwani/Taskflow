'use client'

import { CheckCircle2, Circle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useUpdateTask } from '@/lib/task-queries'

type ToggleTaskButtonProps = {
  taskId: string
  completed: boolean
}

export function ToggleTaskButton({
  taskId,
  completed,
}: ToggleTaskButtonProps) {
  const mutation = useUpdateTask()

  function handleToggle() {
    mutation.mutate({
      id: taskId,
      input: { status: completed ? 'todo' : 'done' },
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        disabled={mutation.isPending}
        aria-label={completed ? 'Mark task as pending' : 'Mark task as completed'}
        className="shrink-0"
      >
        {completed ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        ) : (
          <Circle className="h-6 w-6 text-muted-foreground" />
        )}
      </Button>
      {mutation.isError && (
        <span role="alert" className="max-w-32 text-center text-xs text-destructive">
          {mutation.error.message}
        </span>
      )}
    </div>
  )
}
