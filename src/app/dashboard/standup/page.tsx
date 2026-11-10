'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { aiApi, type AiUsage } from '@/lib/ai-api'
import { tasksApi } from '@/lib/tasks-api'

const usageQueryKey = ['ai', 'usage'] as const

function formatCost(value: number) {
  return value < 0.0001 ? '<$0.0001' : `$${value.toFixed(4)}`
}

function UsageSummary({ usage }: { usage: AiUsage }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm">
      <span className="font-medium">{usage.remaining} of {usage.dailyLimit} AI requests left today</span>
      <span className="text-muted-foreground">Average model call: {formatCost(usage.averageCostPerModelCallUsd)}</span>
    </div>
  )
}

export default function StandupPage() {
  const queryClient = useQueryClient()
  const [digest, setDigest] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [taskSummary, setTaskSummary] = useState('')
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isSummarizingTask, setIsSummarizingTask] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const usageQuery = useQuery({
    queryKey: usageQueryKey,
    queryFn: aiApi.usage,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
  const tasksQuery = useQuery({
    queryKey: ['tasks', 'summary-options'],
    queryFn: () => tasksApi.list({ limit: 100 }),
    staleTime: 30_000,
  })

  async function generateDigest() {
    abortRef.current?.abort()
    const abortController = new AbortController()
    abortRef.current = abortController
    setDigest('')
    setError(null)
    setIsStreaming(true)
    try {
      await aiApi.streamDailyDigest((chunk) => setDigest((current) => current + chunk), abortController.signal)
      void queryClient.invalidateQueries({ queryKey: usageQueryKey })
    } catch (cause) {
      if (!abortController.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'The digest could not be generated.')
      }
    } finally {
      if (!abortController.signal.aborted) setIsStreaming(false)
    }
  }

  async function summarizeTask() {
    if (!selectedTaskId) return
    abortRef.current?.abort()
    const abortController = new AbortController()
    abortRef.current = abortController
    setTaskSummary('')
    setSummaryError(null)
    setIsSummarizingTask(true)
    try {
      await aiApi.streamTaskSummary(selectedTaskId, (chunk) => {
        setTaskSummary((current) => current + chunk)
      }, abortController.signal)
      void queryClient.invalidateQueries({ queryKey: usageQueryKey })
    } catch (cause) {
      if (!abortController.signal.aborted) {
        setSummaryError(cause instanceof Error ? cause.message : 'The task summary could not be generated.')
      }
    } finally {
      if (!abortController.signal.aborted) setIsSummarizingTask(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-4.25rem)] px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.1] via-card to-card p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AI workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Daily digest</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Get a streamed standup summary of your 100 most recently created tasks across the teams and projects you can access.
          </p>
        </header>

        <Card className="gap-0 overflow-hidden border-transparent py-0 shadow-sm ring-1 ring-border/70">
          <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="size-5 text-primary" /> Workspace standup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-4 sm:p-6">
            {usageQuery.data && <UsageSummary usage={usageQuery.data} />}
            {usageQuery.isError && <p className="text-sm text-muted-foreground">Usage details are unavailable right now.</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => void generateDigest()} disabled={isStreaming || usageQuery.data?.remaining === 0} className="gap-2">
                {isStreaming ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {isStreaming ? 'Writing your digest…' : digest ? 'Generate a fresh digest' : 'Generate daily digest'}
              </Button>
              <span className="text-xs text-muted-foreground">Nothing is changed or saved by this summary.</span>
            </div>
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
            {digest && (
              <section aria-label="Daily digest" aria-live="polite" className="whitespace-pre-wrap rounded-xl border border-border/70 bg-background p-4 text-sm leading-7 sm:p-5">
                {digest}
                {isStreaming && <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-primary align-middle" aria-hidden="true" />}
              </section>
            )}
            {!digest && !isStreaming && !error && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Your digest will appear here as it streams in. Task content is treated as untrusted input and is only summarized.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 overflow-hidden border-transparent py-0 shadow-sm ring-1 ring-border/70">
          <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
            <CardTitle className="text-lg">Summarize one task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <p className="text-sm text-muted-foreground">Choose an accessible task to get a streamed summary of its current status and next step.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                aria-label="Choose a task to summarize"
                value={selectedTaskId}
                onChange={(event) => { setSelectedTaskId(event.target.value); setTaskSummary('') }}
                disabled={tasksQuery.isPending || isSummarizingTask}
                className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">{tasksQuery.isPending ? 'Loading tasks…' : 'Choose a task'}</option>
                {tasksQuery.data?.data.map((task) => (
                  <option key={task._id} value={task._id}>{task.title} · {task.status}</option>
                ))}
              </select>
              <Button type="button" onClick={() => void summarizeTask()} disabled={!selectedTaskId || isSummarizingTask || usageQuery.data?.remaining === 0} className="h-11 gap-2 sm:min-w-40">
                {isSummarizingTask ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {isSummarizingTask ? 'Summarizing…' : 'Summarize task'}
              </Button>
            </div>
            {tasksQuery.isError && <p role="alert" className="text-sm text-destructive">Couldn’t load tasks: {tasksQuery.error.message}</p>}
            {summaryError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{summaryError}</p>}
            {taskSummary && <section aria-label="Task summary" aria-live="polite" className="whitespace-pre-wrap rounded-xl border border-border/70 bg-background p-4 text-sm leading-7">{taskSummary}{isSummarizingTask && <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-primary align-middle" aria-hidden="true" />}</section>}
            {tasksQuery.data?.data.length === 0 && <p className="text-sm text-muted-foreground">Create a task first to generate a summary.</p>}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
