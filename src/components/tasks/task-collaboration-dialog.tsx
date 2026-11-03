'use client'

import { type FormEvent, useState } from 'react'
import { Activity, MessageSquareText, Send } from 'lucide-react'

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
    <li className="space-y-2 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold">{displayName(comment.author)}</span>
        <time className="text-xs text-muted-foreground" dateTime={comment.createdAt}>
          {formatTimestamp(comment.createdAt)}
        </time>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">{comment.body}</p>
    </li>
  )
}

function ActivityItem({ activity }: { activity: TaskActivity }) {
  return (
    <li className="relative border-l-2 border-primary/35 py-0.5 pl-4 before:absolute before:-left-[5px] before:top-1 before:size-2 before:rounded-full before:bg-primary before:ring-4 before:ring-background">
      <p className="text-sm leading-5">
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
        className="rounded-lg border-primary/15 bg-primary/[0.04] text-primary hover:bg-primary/10"
        onClick={() => setOpen(true)}
        aria-label={`Open activity and comments for ${taskTitle}`}
      >
        <MessageSquareText aria-hidden="true" className="mr-1.5 size-4" />
        Activity & comments
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-border/70 bg-card/98 p-5 shadow-2xl sm:max-w-2xl sm:p-7">
          <DialogHeader className="mb-1">
            <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">Activity & comments</DialogTitle>
            <DialogDescription className="break-words">{taskTitle}</DialogDescription>
          </DialogHeader>

          <section aria-labelledby={`activity-heading-${taskId}`} className="space-y-4">
            <h3 id={`activity-heading-${taskId}`} className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300"><Activity className="size-3.5" /></span>
              Activity
            </h3>
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
              <ol className="space-y-4 rounded-xl bg-muted/30 p-4">
                {activityQuery.data.map((activity) => (
                  <ActivityItem key={activity._id} activity={activity} />
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby={`comments-heading-${taskId}`} className="space-y-4 border-t border-border/70 pt-5">
            <h3 id={`comments-heading-${taskId}`} className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300"><MessageSquareText className="size-3.5" /></span>
              Comments
            </h3>
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
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
                <MessageSquareText className="mx-auto mb-2 size-5 text-muted-foreground/70" />
                <p className="text-sm font-medium">Start the conversation</p>
                <p className="mt-1 text-xs text-muted-foreground">Comments from your team will show up here.</p>
              </div>
            ) : (
              <ol className="max-h-64 space-y-3 overflow-y-auto pr-1">
                {commentsQuery.data.map((comment) => (
                  <CommentItem key={comment._id} comment={comment} />
                ))}
              </ol>
            )}

            {canComment ? (
              <form onSubmit={submitComment} className="space-y-3 rounded-2xl border border-border/70 bg-muted/25 p-4 sm:p-5">
                <div>
                  <label htmlFor={`comment-body-${taskId}`} className="mb-2 block text-sm font-semibold">
                    Add a comment
                  </label>
                  <p className="mb-3 text-xs leading-5 text-muted-foreground">Share an update or ask your team a question.</p>
                </div>
                <Textarea
                  id={`comment-body-${taskId}`}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={2000}
                  placeholder="Write a comment…"
                  aria-invalid={createComment.isError}
                  disabled={createComment.isPending}
                  className="min-h-28 resize-y rounded-xl border-border/80 bg-background px-3 py-3 text-sm leading-6 shadow-sm placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/20"
                />
                {createComment.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {createComment.error.message}
                  </p>
                )}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-muted-foreground">{body.length}/2000</span>
                  <Button type="submit" size="sm" className="rounded-lg px-3 shadow-sm shadow-primary/15" disabled={!body.trim() || createComment.isPending}>
                    <Send className="mr-1.5 size-3.5" />
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
