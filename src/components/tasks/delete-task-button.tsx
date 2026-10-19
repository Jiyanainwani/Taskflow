'use client'

import { useState } from 'react'

import { deleteTask } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'

type DeleteTaskButtonProps = {
  taskId: string
}

export function DeleteTaskButton({
  taskId,
}: DeleteTaskButtonProps) {
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    const confirmed = window.confirm(
      'Are you sure you want to delete this task?',
    )

    if (!confirmed) {
      return
    }

    setPending(true)

    await deleteTask(taskId)

    setPending(false)
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={pending}
    >
      {pending ? 'Deleting...' : 'Delete'}
    </Button>
  )
}