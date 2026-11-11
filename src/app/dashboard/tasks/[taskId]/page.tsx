'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarClock, MessageSquareText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { tasksApi } from '@/lib/tasks-api'
import { taskCollaborationApi } from '@/lib/task-collaboration-api'

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'No due date'
}

export default function TaskSourcePage() {
  const params = useParams<{ taskId: string }>()
  const taskId = params.taskId
  const taskQuery = useQuery({
    queryKey: ['tasks', taskId],
    queryFn: () => tasksApi.get(taskId),
    enabled: Boolean(taskId),
  })
  const commentsQuery = useQuery({
    queryKey: ['tasks', taskId, 'comments'],
    queryFn: () => taskCollaborationApi.listComments(taskId),
    enabled: Boolean(taskId && taskQuery.data),
  })

  useEffect(() => {
    if (!commentsQuery.data || !window.location.hash.startsWith('#comment-')) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [commentsQuery.data])

  return (
    <main className="min-h-[calc(100vh-4.25rem)] px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <Button
          render={<Link href="/dashboard" />}
          nativeButton={false}
          variant="ghost"
          className="-ml-3 gap-2"
        >
          <ArrowLeft className="size-4" /> Back to dashboard
        </Button>

        {taskQuery.isPending ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading cited task…</CardContent></Card>
        ) : taskQuery.isError ? (
          <Card className="border-destructive/40">
            <CardContent className="space-y-3 p-6">
              <h1 className="text-lg font-semibold">This task isn’t available</h1>
              <p role="alert" className="text-sm text-muted-foreground">
                It may have been deleted or you may no longer have access to it. {taskQuery.error.message}
              </p>
            </CardContent>
          </Card>
        ) : taskQuery.data ? (
          <>
            <Card id={`task-${taskId}`} className="gap-0 overflow-hidden border-transparent py-0 shadow-sm ring-1 ring-border/70">
              <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Cited workspace task</p>
                <CardTitle className="mt-1 text-xl">{taskQuery.data.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold capitalize text-primary">{taskQuery.data.status}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 font-medium capitalize text-muted-foreground">{taskQuery.data.priority} priority</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground"><CalendarClock className="size-3.5" />{formatDate(taskQuery.data.dueDate)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {taskQuery.data.description || 'This task has no description.'}
                </p>
              </CardContent>
            </Card>

            <Card className="gap-0 overflow-hidden border-transparent py-0 shadow-sm ring-1 ring-border/70">
              <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquareText className="size-5 text-primary" /> Comments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {commentsQuery.isPending ? (
                  <p className="text-sm text-muted-foreground">Loading task comments…</p>
                ) : commentsQuery.isError ? (
                  <p role="alert" className="text-sm text-destructive">Comments could not be loaded: {commentsQuery.error.message}</p>
                ) : commentsQuery.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">There are no comments on this task.</p>
                ) : (
                  <ol className="space-y-3">
                    {commentsQuery.data.map((comment) => (
                      <li id={`comment-${comment._id}`} key={comment._id} className="scroll-mt-24 rounded-xl border border-border/70 bg-background p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {typeof comment.author === 'string' ? 'TaskFlow member' : comment.author.name || comment.author.email}
                          </span>
                          <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</time>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{comment.body}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </main>
  )
}
