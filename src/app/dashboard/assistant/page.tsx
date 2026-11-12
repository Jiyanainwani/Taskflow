'use client'

import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Check, LoaderCircle, ShieldCheck, Sparkles, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { aiApi, type WorkspaceAssistantResult } from '@/lib/ai-api'

const usageQueryKey = ['ai', 'usage'] as const
type PendingAction = NonNullable<WorkspaceAssistantResult['pendingAction']>

export default function WorkspaceAssistantPage() {
  const queryClient = useQueryClient()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [notice, setNotice] = useState('')
  const usageQuery = useQuery({
    queryKey: usageQueryKey,
    queryFn: aiApi.usage,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
  const assistantMutation = useMutation({
    mutationFn: aiApi.runWorkspaceAssistant,
    onSuccess: (result) => {
      setAnswer(result.answer)
      setPendingAction(result.pendingAction)
      setNotice('')
      void queryClient.invalidateQueries({ queryKey: usageQueryKey })
    },
  })
  const approvalMutation = useMutation({
    mutationFn: ({ approvalId, approved }: { approvalId: string; approved: boolean }) =>
      aiApi.confirmWorkspaceAssistantAction(approvalId, approved),
    onSuccess: (result) => {
      setNotice(result.message)
      setPendingAction(null)
      if (result.approved) void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = question.trim()
    if (!normalized || assistantMutation.isPending || approvalMutation.isPending) return
    setPendingAction(null)
    setNotice('')
    assistantMutation.mutate(normalized)
  }

  const action = pendingAction?.action
  const fields = action?.input

  return (
    <main className="min-h-[calc(100vh-4.25rem)] px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <header className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.1] via-card to-card p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AI workspace</p>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Bot className="size-7 text-primary" aria-hidden="true" /> Task assistant
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Ask about accessible tasks or request a task change. The assistant prepares changes for your review; nothing is saved until you confirm.
          </p>
        </header>

        <Card className="gap-0 overflow-hidden border-transparent py-0 shadow-sm ring-1 ring-border/70">
          <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
            <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="size-5 text-primary" /> Workspace assistant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-4 sm:p-6">
            {usageQuery.data && <p className="text-xs text-muted-foreground">{usageQuery.data.remaining} of {usageQuery.data.dailyLimit} AI requests left today</p>}
            {answer && <article className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm leading-6">{answer}</article>}

            {pendingAction && fields && (
              <section aria-labelledby="proposal-title" className="space-y-4 rounded-xl border border-primary/40 bg-primary/[0.035] p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <h2 id="proposal-title" className="font-semibold">Review proposed {action.type === 'create_task' ? 'task' : 'task update'}</h2>
                    {action.type === 'update_task' && <p className="text-xs text-muted-foreground">Task ID: {action.input.taskId}</p>}
                    {fields.title && <p className="text-sm font-medium">{fields.title}</p>}
                    {fields.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{fields.description}</p>}
                    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {fields.status && <div><dt className="inline font-medium">Status: </dt><dd className="inline capitalize">{fields.status.replace('-', ' ')}</dd></div>}
                      {fields.priority && <div><dt className="inline font-medium">Priority: </dt><dd className="inline capitalize">{fields.priority}</dd></div>}
                      {fields.dueDate && <div><dt className="inline font-medium">Due: </dt><dd className="inline">{new Date(fields.dueDate).toLocaleString()}</dd></div>}
                    </dl>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">This approval expires in {Math.ceil(pendingAction.expiresInSeconds / 60)} minutes. Confirming sends the change to TaskFlow.</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => approvalMutation.mutate({ approvalId: pendingAction.approvalId, approved: true })}
                    disabled={approvalMutation.isPending}
                    className="gap-2"
                  >
                    {approvalMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Confirm and save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => approvalMutation.mutate({ approvalId: pendingAction.approvalId, approved: false })}
                    disabled={approvalMutation.isPending}
                    className="gap-2"
                  >
                    <X className="size-4" /> Reject
                  </Button>
                </div>
              </section>
            )}

            {notice && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">{notice}</p>}
            {assistantMutation.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{assistantMutation.error.message}</p>}
            {approvalMutation.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{approvalMutation.error.message}</p>}

            <form onSubmit={submitRequest} className="space-y-3 border-t border-border/60 pt-5">
              <label htmlFor="assistant-request" className="text-sm font-semibold">What should the assistant do?</label>
              <Textarea
                id="assistant-request"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Create a high-priority task to prepare release notes."
                disabled={assistantMutation.isPending || usageQuery.data?.remaining === 0}
                className="min-h-24 resize-y bg-background"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Task data is untrusted context. Task changes require your explicit confirmation.</p>
                <Button type="submit" disabled={!question.trim() || question.length > 500 || assistantMutation.isPending || usageQuery.data?.remaining === 0} className="gap-2">
                  {assistantMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {assistantMutation.isPending ? 'Thinking…' : 'Send request'}
                </Button>
              </div>
              {usageQuery.data?.remaining === 0 && <p role="status" className="text-sm text-muted-foreground">Daily AI limit reached. Try again tomorrow.</p>}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
