'use client'

import { useActionState } from 'react'

import { updateTask } from '@/app/dashboard/actions'
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
import type { Task } from '@/types/task'

type EditTaskFormProps = {
  task: Task
}

const initialState = {
  success: false,
  message: '',
}

export function EditTaskForm({ task }: EditTaskFormProps) {
  const [state, formAction, pending] = useActionState(
    updateTask,
    initialState,
  )

  return (
    <Dialog>
     <DialogTrigger
  render={
    <Button variant="outline" size="sm" />
  }
>
  Edit
</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update the details of your task.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={task.id} />

          <div className="space-y-2">
            <Label htmlFor={`title-${task.id}`}>Title</Label>

            <Input
              id={`title-${task.id}`}
              name="title"
              defaultValue={task.title}
              placeholder="Task title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`description-${task.id}`}>
              Description
            </Label>

            <Textarea
              id={`description-${task.id}`}
              name="description"
              defaultValue={task.description}
              placeholder="Task description"
              rows={4}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id={`completed-${task.id}`}
              name="completed"
              type="checkbox"
              value="true"
              defaultChecked={task.completed}
              className="h-4 w-4"
            />

            <Label htmlFor={`completed-${task.id}`}>
              Mark as completed
            </Label>
          </div>

          {state.message && (
            <p className="text-sm text-muted-foreground">
              {state.message}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}