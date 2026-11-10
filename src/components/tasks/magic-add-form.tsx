'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, LoaderCircle, RotateCcw, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { aiApi, type AiUsage, type MagicTaskDraft } from '@/lib/ai-api'
import { useCreateTask } from '@/lib/task-queries'

type EditableDraft = MagicTaskDraft & { id: string }

const usageQueryKey = ['ai', 'usage'] as const

function formatCost(value: number) {
  return value < 0.0001 ? '<$0.0001' : `$${value.toFixed(4)}`
}

function UsageMeter({ usage }: { usage: AiUsage }) {
  const percent = usage.dailyLimit === 0
    ? 0
    : Math.min(100, (usage.requestsUsed / usage.dailyLimit) * 100)

  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span className="font-medium text-foreground">
          {usage.remaining} of {usage.dailyLimit} AI requests left today
        </span>
        <span className="text-muted-foreground">
          Average model call: {formatCost(usage.averageCostPerModelCallUsd)}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Daily AI requests used"
        aria-valuemin={0}
        aria-valuemax={usage.dailyLimit}
        aria-valuenow={usage.requestsUsed}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function MagicAddForm() {
  const queryClient = useQueryClient()
  const createTask = useCreateTask()
  const [notes, setNotes] = useState('')
  const [drafts, setDrafts] = useState<EditableDraft[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [hasGenerated, setHasGenerated] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const usageQuery = useQuery({
    queryKey: usageQueryKey,
    queryFn: aiApi.usage,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const generateMutation = useMutation({
    mutationFn: aiApi.magicAdd,
    onSuccess: (result) => {
      const nextDrafts = result.tasks.map((task, index) => ({
        ...task,
        id: `${Date.now()}-${index}`,
      }))
      setDrafts(nextDrafts)
      setSelectedIds(new Set(nextDrafts.map((task) => task.id)))
      setSavedIds(new Set())
      setSaveError(null)
      setHasGenerated(true)
      void queryClient.invalidateQueries({ queryKey: usageQueryKey })
    },
  })

  const isGenerating = generateMutation.isPending
  const canGenerate = notes.trim().length > 0
    && notes.length <= 12_000
    && !isGenerating
    && usageQuery.data?.remaining !== 0

  function startOver() {
    setNotes('')
    setDrafts([])
    setSelectedIds(new Set())
    setSavedIds(new Set())
    setHasGenerated(false)
    setSaveError(null)
    generateMutation.reset()
  }

  function updateDraft(id: string, update: Partial<MagicTaskDraft>) {
    setDrafts((current) => current.map((draft) =>
      draft.id === id ? { ...draft, ...update } : draft,
    ))
  }

  function toggleDraft(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function saveSelectedDrafts() {
    const pendingDrafts = drafts.filter(
      (draft) => selectedIds.has(draft.id) && !savedIds.has(draft.id),
    )
    if (pendingDrafts.length === 0) return

    setIsSaving(true)
    setSaveError(null)
    const successfullySaved = new Set(savedIds)

    for (const draft of pendingDrafts) {
      try {
        await createTask.mutateAsync({
          title: draft.title.trim(),
          description: draft.description.trim(),
          priority: draft.priority,
        })
        successfullySaved.add(draft.id)
        setSavedIds(new Set(successfullySaved))
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : 'Some tasks could not be saved. You can retry the remaining drafts.',
        )
        break
      }
    }

    setIsSaving(false)
  }

  const selectedCount = drafts.filter((draft) => selectedIds.has(draft.id)).length
  const unsavedSelectedCount = drafts.filter(
    (draft) => selectedIds.has(draft.id) && !savedIds.has(draft.id),
  ).length
  const savedCount = drafts.filter((draft) => savedIds.has(draft.id)).length

  return (
    <Card id="magic-add" className="gap-0 overflow-hidden border-transparent bg-card py-0 shadow-sm ring-1 ring-border/70">
      <CardHeader className="w-full border-b border-border/60 bg-gradient-to-r from-violet-500/[0.12] via-primary/[0.05] to-transparent py-4 sm:py-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">
              Draft tasks from notes
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Review and edit suggestions before saving.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5 lg:p-6">
        {usageQuery.data && <UsageMeter usage={usageQuery.data} />}

        {usageQuery.isError && (
          <p className="text-sm text-muted-foreground">
            Usage details are unavailable right now. You can still try Magic Add.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="magic-add-notes">Meeting notes</Label>
          <Textarea
            id="magic-add-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={12_000}
            rows={4}
            placeholder={'Paste notes here…\n\nFor example: Maya will send the QA checklist by Friday. Ravi will update the onboarding page.'}
            disabled={isGenerating || isSaving || drafts.length > 0}
            aria-describedby="magic-add-note-help"
            className="min-h-24 resize-y bg-background text-sm shadow-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id="magic-add-note-help" className="text-xs text-muted-foreground">
              AI suggestions are drafts. Nothing is saved until you confirm.
            </p>
            <span className={`text-xs ${notes.length > 12_000 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {notes.length.toLocaleString()} / 12,000
            </span>
          </div>
        </div>

        {generateMutation.isError && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {generateMutation.error.message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => generateMutation.mutate(notes)}
            disabled={!canGenerate || drafts.length > 0}
            className="gap-2 rounded-lg px-4"
          >
            {isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {isGenerating ? 'Finding task drafts…' : drafts.length > 0 ? 'Drafts ready' : 'Generate task drafts'}
          </Button>
          {drafts.length > 0 && (
            <Button type="button" variant="ghost" onClick={startOver} disabled={isSaving} className="gap-2">
              <RotateCcw className="size-4" /> Start over
            </Button>
          )}
          {usageQuery.data?.remaining === 0 && (
            <span role="status" className="text-sm text-muted-foreground">
              Daily AI limit reached. Try again tomorrow.
            </span>
          )}
        </div>

        {hasGenerated && drafts.length === 0 && (
          <p role="status" className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            No clear task suggestions were found in those notes. Try adding more detail, then start over to try again.
          </p>
        )}

        {drafts.length > 0 && (
          <section aria-labelledby="magic-add-preview-heading" className="space-y-4 border-t border-border/60 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 id="magic-add-preview-heading" className="font-semibold tracking-tight">
                  Review your drafts
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Edit, deselect, or save the suggestions you want.
                </p>
              </div>
              {generateMutation.data?.cached && (
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  Loaded from cache
                </span>
              )}
            </div>

            <div className="space-y-3">
              {drafts.map((draft, index) => {
                const isSaved = savedIds.has(draft.id)
                return (
                  <article key={draft.id} className="rounded-xl border border-border/70 bg-background/70 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <input
                        id={`magic-add-select-${draft.id}`}
                        type="checkbox"
                        checked={selectedIds.has(draft.id)}
                        onChange={() => toggleDraft(draft.id)}
                        disabled={isSaving || isSaved}
                        aria-label={`Include task draft ${index + 1}`}
                        className="mt-1 size-4 shrink-0 accent-primary"
                      />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                          <div className="space-y-1.5">
                            <Label htmlFor={`magic-add-title-${draft.id}`} className="text-xs">Task title</Label>
                            <Input
                              id={`magic-add-title-${draft.id}`}
                              value={draft.title}
                              maxLength={200}
                              onChange={(event) => updateDraft(draft.id, { title: event.target.value })}
                              disabled={isSaving || isSaved}
                              className="bg-background"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`magic-add-priority-${draft.id}`} className="text-xs">Priority</Label>
                            <select
                              id={`magic-add-priority-${draft.id}`}
                              value={draft.priority}
                              onChange={(event) => updateDraft(draft.id, { priority: event.target.value as MagicTaskDraft['priority'] })}
                              disabled={isSaving || isSaved}
                              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`magic-add-description-${draft.id}`} className="text-xs">Description</Label>
                          <Textarea
                            id={`magic-add-description-${draft.id}`}
                            value={draft.description}
                            maxLength={2_000}
                            rows={2}
                            onChange={(event) => updateDraft(draft.id, { description: event.target.value })}
                            disabled={isSaving || isSaved}
                            className="min-h-20 resize-y bg-background"
                          />
                        </div>
                      </div>
                      {isSaved && <Check className="mt-1 size-5 shrink-0 text-emerald-600" aria-label="Saved" />}
                    </div>
                  </article>
                )
              })}
            </div>

            {saveError && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {saveError} Saved drafts stay marked; retry to save the remaining selected drafts.
              </p>
            )}

            {savedCount > 0 && unsavedSelectedCount === 0 ? (
              <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {savedCount === drafts.length
                    ? `${savedCount} ${savedCount === 1 ? 'task' : 'tasks'} saved to your task board.`
                    : `${savedCount} ${savedCount === 1 ? 'task' : 'tasks'} saved. Select any remaining drafts to save them too.`}
                </p>
                <Button type="button" variant="outline" onClick={startOver} className="gap-2">
                  <Trash2 className="size-4" /> Clear drafts
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {selectedCount} selected{savedCount > 0 ? ` · ${savedCount} saved` : ''}
                </p>
                <Button
                  type="button"
                  onClick={() => void saveSelectedDrafts()}
                  disabled={isSaving || unsavedSelectedCount === 0 || drafts.some((draft) => selectedIds.has(draft.id) && !savedIds.has(draft.id) && !draft.title.trim())}
                  className="gap-2 rounded-lg px-4"
                >
                  {isSaving && <LoaderCircle className="size-4 animate-spin" />}
                  {isSaving ? 'Saving tasks…' : saveError ? 'Retry saving remaining' : `Create ${unsavedSelectedCount} ${unsavedSelectedCount === 1 ? 'task' : 'tasks'}`}
                </Button>
              </div>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  )
}
