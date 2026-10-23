'use client'

import { Button } from '@/components/ui/button'
import { useDeleteTask } from '@/lib/task-queries'

type DeleteTaskButtonProps = {
  taskId: string
}

export function DeleteTaskButton({
  taskId,
}: DeleteTaskButtonProps) {
  const mutation = useDeleteTask()

  function handleDelete() {
    const confirmed = window.confirm(
      'Are you sure you want to delete this task?',
    )

    if (!confirmed) {
      return
    }

    mutation.mutate(taskId)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Deleting...' : 'Delete'}
      </Button>
      {mutation.isError && (
        <span role="alert" className="max-w-40 text-right text-xs text-destructive">
          {mutation.error.message}
        </span>
      )}
    </div>
  )
}
