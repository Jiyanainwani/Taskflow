'use client'

import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BrainCircuit, FileText, LoaderCircle, MessageSquareText, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { aiApi, type AiUsage, type WorkspaceAnswer } from '@/lib/ai-api'

const usageQueryKey = ['ai', 'usage'] as const

type ChatTurn = WorkspaceAnswer & { question: string }

function UsageHint({ usage }: { usage: AiUsage }) {
  return (
    <p className="text-xs text-muted-foreground">
      {usage.remaining} of {usage.dailyLimit} AI requests left today
    </p>
  )
}

export default function AskWorkspacePage() {
  const queryClient = useQueryClient()
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const usageQuery = useQuery({
    queryKey: usageQueryKey,
    queryFn: aiApi.usage,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
  const askMutation = useMutation({
    mutationFn: ({ question: submittedQuestion, previousQuestions }: { question: string; previousQuestions: string[] }) =>
      aiApi.askWorkspace(submittedQuestion, previousQuestions),
    onSuccess: (result, variables) => {
      setTurns((current) => [...current, { question: variables.question, ...result }])
      setQuestion('')
      void queryClient.invalidateQueries({ queryKey: usageQueryKey })
    },
  })

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = question.trim()
    if (!normalized || askMutation.isPending) return
    askMutation.mutate({
      question: normalized,
      previousQuestions: turns.slice(-3).map((turn) => turn.question),
    })
  }

  return (
    <main className="min-h-[calc(100vh-4.25rem)] px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.1] via-card to-card p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AI workspace</p>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            <BrainCircuit className="size-7 text-primary" aria-hidden="true" /> Ask your workspace
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Ask questions about tasks and comments you can access. Answers include links to the source tasks.
          </p>
        </header>

        <Card className="gap-0 overflow-hidden border-transparent py-0 shadow-sm ring-1 ring-border/70">
          <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquareText className="size-5 text-primary" /> Workspace chat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-4 sm:p-6">
            {usageQuery.data && <UsageHint usage={usageQuery.data} />}
            {usageQuery.isError && <p className="text-xs text-muted-foreground">Usage details are unavailable right now.</p>}

            {turns.length > 0 ? (
              <ol aria-label="Workspace conversation" className="space-y-6">
                {turns.map((turn, index) => (
                  <li key={`${index}-${turn.question}`} className="space-y-3">
                    <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground sm:max-w-[80%]">
                      {turn.question}
                    </div>
                    <article className="max-w-[95%] space-y-3 rounded-2xl rounded-bl-md border border-border/70 bg-muted/25 px-4 py-4 sm:max-w-[85%] sm:px-5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <Sparkles className="size-4" aria-hidden="true" /> TaskFlow answer
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6">{turn.answer}</p>
                      {turn.citations.length > 0 && (
                        <section aria-label="Sources" className="space-y-2 border-t border-border/60 pt-3">
                          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources</h2>
                          <ul className="grid gap-2 sm:grid-cols-2">
                            {turn.citations.map((citation) => (
                              <li key={`${citation.id}-${citation.taskId}`}>
                                <Link
                                  href={citation.href}
                                  className="block rounded-xl border border-border/70 bg-background p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                                >
                                  <span className="flex items-center gap-2 text-xs font-semibold">
                                    <FileText className="size-3.5 text-primary" aria-hidden="true" />
                                    [{citation.id}] {citation.title}
                                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">{citation.type}</span>
                                  </span>
                                  <span className="mt-2 block line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{citation.excerpt}</span>
                                  <span className="mt-2 block text-xs font-medium text-primary">{citation.type === 'comment' ? 'Open cited comment' : 'Open task'}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </article>
                  </li>
                ))}
                {askMutation.isPending && (
                  <li role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" /> Searching accessible tasks and comments…
                  </li>
                )}
              </ol>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <BrainCircuit className="mx-auto size-7 text-primary/70" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium">Ask about progress, blockers, or decisions</p>
                <p className="mt-1 text-sm text-muted-foreground">TaskFlow retrieves relevant tasks and comments and cites the sources it used.</p>
              </div>
            )}

            {askMutation.isError && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {askMutation.error.message}
              </p>
            )}

            <form onSubmit={submitQuestion} className="space-y-3 border-t border-border/60 pt-5">
              <label htmlFor="workspace-question" className="text-sm font-semibold">Your question</label>
              <Textarea
                id="workspace-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="What is blocked waiting for QA?"
                disabled={askMutation.isPending || usageQuery.data?.remaining === 0}
                className="min-h-24 resize-y bg-background"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Answers are grounded in accessible workspace data. Task content is treated as untrusted input.</p>
                <Button type="submit" disabled={!question.trim() || question.length > 500 || askMutation.isPending || usageQuery.data?.remaining === 0} className="gap-2">
                  {askMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {askMutation.isPending ? 'Searching and answering…' : 'Ask workspace'}
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
