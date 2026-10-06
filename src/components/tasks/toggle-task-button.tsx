'use client'

import { useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'

import { toggleTask } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'

type ToggleTaskButtonProps = {
  taskId: string
  completed: boolean
}

export function ToggleTaskButton({
  taskId,
  completed,
}: ToggleTaskButtonProps) {
  const [pending, setPending] = useState(false)

  async function handleToggle() {
    setPending(true)

    await toggleTask(taskId)

    setPending(false)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={pending}
      aria-label={
        completed
          ? 'Mark task as pending'
          : 'Mark task as completed'
      }
      className="shrink-0"
    >
      {completed ? (
        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
      ) : (
        <Circle className="h-6 w-6 text-muted-foreground" />
      )}
    </Button>
  )
}