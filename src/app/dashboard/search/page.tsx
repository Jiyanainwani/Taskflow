'use client'

import { FormEvent, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowUpRight, LoaderCircle, Search, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { aiApi } from '@/lib/ai-api'

export default function WorkspaceSearchPage() {
  const [query, setQuery] = useState('')
  const searchMutation = useMutation({ mutationFn: aiApi.search })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = query.trim()
    if (value) searchMutation.mutate(value)
  }

  return (
    <main className="min-h-[calc(100vh-4.25rem)] px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.1] via-card to-card p-5 sm:p-7">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Sparkles className="size-4" /> AI workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Search by meaning</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Find tasks and comments using natural language, even when they don’t use the exact words in your query.
          </p>
        </header>

        <Card className="gap-0 overflow-hidden border-transparent py-0 shadow-sm ring-1 ring-border/70">
          <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
            <CardTitle className="text-lg">Workspace search</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-4 sm:p-6">
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={500}
                placeholder="e.g. work blocked waiting for the QA checklist"
                aria-label="Search tasks and comments by meaning"
                className="h-11 flex-1"
              />
              <Button type="submit" disabled={!query.trim() || searchMutation.isPending} className="h-11 gap-2 sm:min-w-32">
                {searchMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
                {searchMutation.isPending ? 'Searching…' : 'Search'}
              </Button>
            </form>

            {searchMutation.isError && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {searchMutation.error.message}
              </p>
            )}

            {searchMutation.data && (
              <section aria-live="polite" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{searchMutation.data.results.length} matching {searchMutation.data.results.length === 1 ? 'result' : 'results'}</h2>
                  <span className="text-xs text-muted-foreground">
                    {searchMutation.data.cached ? 'Cached result' : `Indexed ${searchMutation.data.indexedSources} recent items`}
                  </span>
                </div>
                {searchMutation.data.results.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No close matches found. Try describing the goal, topic, or blocker in different words.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {searchMutation.data.results.map((result, index) => (
                      <article key={`${result.type}-${result.taskId}-${index}`} className="rounded-xl border border-border/70 bg-background p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">{result.type}</span>
                            <span className="text-xs text-muted-foreground">Similarity score · {result.score.toFixed(2)}</span>
                          </div>
                          <Link href="/dashboard#tasks" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                            Open task board <ArrowUpRight className="size-3.5" />
                          </Link>
                        </div>
                        <h3 className="mt-3 font-semibold">{result.title}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{result.snippet}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
            {!searchMutation.data && !searchMutation.isError && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Search checks up to 500 recent accessible tasks and 500 comments. Your private tasks and team access rules are respected.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
