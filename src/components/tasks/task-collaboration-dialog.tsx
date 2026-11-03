'use client'

import { type FormEvent, useState } from 'react'
import { MessageSquareText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { TaskAttachmentsPanel } from '@/components/tasks/task-attachments-panel'
import {
  useCreateTaskComment,
  useTaskActivity,
  useTaskComments,
} from '@/lib/task-collaboration-queries'
import type {
  TaskActivity,
  TaskCollaborationUser,
  TaskComment,
} from '@/lib/task-collaboration-api'

type TaskCollaborationDialogProps = {
  taskId: string
  taskTitle: string
  canComment: boolean
}

function displayName(user: TaskCollaborationUser | string) {
  if (typeof user === 'string') return 'TaskFlow member'
  return user.name || user.email || 'TaskFlow member'
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString()
}

function LoadingMessage() {
  return <p className="text-sm text-muted-foreground">Loading…</p>
}

function CommentItem({ comment }: { comment: TaskComment }) {
  return (
    <li className="space-y-1 rounded-lg bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{displayName(comment.author)}</span>
        <time className="text-xs text-muted-foreground" dateTime={comment.createdAt}>
          {formatTimestamp(comment.createdAt)}
        </time>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>
    </li>
  )
}

function ActivityItem({ activity }: { activity: TaskActivity }) {
  return (
    <li className="border-l-2 border-primary/30 pl-3">
      <p className="text-sm">
        <span className="font-medium">{displayName(activity.actor)}</span>{' '}
        {activity.summary.toLowerCase()}
      </p>
      <time className="text-xs text-muted-foreground" dateTime={activity.createdAt}>
        {formatTimestamp(activity.createdAt)}
      </time>
    </li>
  )
}

export function TaskCollaborationDialog({
  taskId,
  taskTitle,
  canComment,
}: TaskCollaborationDialogProps) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const commentsQuery = useTaskComments(taskId, open)
  const activityQuery = useTaskActivity(taskId, open)
  const createComment = useCreateTaskComment(taskId)

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = body.trim()
    if (!value) return

    try {
      await createComment.mutateAsync(value)
      setBody('')
    } catch {
      // The mutation error is shown below; preserve the draft for retry.
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Open activity and comments for ${taskTitle}`}
      >
        <MessageSquareText aria-hidden="true" className="mr-1.5 size-4" />
        Activity & comments
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Activity & comments</DialogTitle>
            <DialogDescription className="break-words">{taskTitle}</DialogDescription>
          </DialogHeader>

          <section aria-labelledby={`activity-heading-${taskId}`} className="space-y-3">
            <h3 id={`activity-heading-${taskId}`} className="font-semibold">Activity</h3>
            {activityQuery.isPending ? (
              <LoadingMessage />
            ) : activityQuery.isError ? (
              <div className="space-y-2">
                <p role="alert" className="text-sm text-destructive">{activityQuery.error.message}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void activityQuery.refetch()}>
                  Retry activity
                </Button>
              </div>
            ) : activityQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-3">
                {activityQuery.data.map((activity) => (
                  <ActivityItem key={activity._id} activity={activity} />
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby={`comments-heading-${taskId}`} className="space-y-3 border-t pt-4">
            <h3 id={`comments-heading-${taskId}`} className="font-semibold">Comments</h3>
            {commentsQuery.isPending ? (
              <LoadingMessage />
            ) : commentsQuery.isError ? (
              <div className="space-y-2">
                <p role="alert" className="text-sm text-destructive">{commentsQuery.error.message}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void commentsQuery.refetch()}>
                  Retry comments
                </Button>
              </div>
            ) : commentsQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <ol className="max-h-56 space-y-2 overflow-y-auto">
                {commentsQuery.data.map((comment) => (
                  <CommentItem key={comment._id} comment={comment} />
                ))}
              </ol>
            )}

            {canComment ? (
              <form onSubmit={submitComment} className="space-y-2 border-t pt-3">
                <label htmlFor={`comment-body-${taskId}`} className="text-sm font-medium">
                  Add a comment
                </label>
                <Textarea
                  id={`comment-body-${taskId}`}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={2000}
                  placeholder="Write a comment…"
                  aria-invalid={createComment.isError}
                  disabled={createComment.isPending}
                />
                {createComment.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {createComment.error.message}
                  </p>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{body.length}/2000</span>
                  <Button type="submit" size="sm" disabled={!body.trim() || createComment.isPending}>
                    {createComment.isPending ? 'Posting…' : 'Post comment'}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="border-t pt-3 text-sm text-muted-foreground">
                Your role allows you to read comments but not post them.
              </p>
            )}
          </section>

          <TaskAttachmentsPanel taskId={taskId} enabled={open} canManage={canComment} />
        </DialogContent>
      </Dialog>
    </>
  )
}
