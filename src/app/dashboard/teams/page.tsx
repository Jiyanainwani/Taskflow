'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, Plus, UsersRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateTeam, useTeams } from '@/lib/workspace-queries'
import { getCurrentUserId } from '@/lib/auth'
import type { ApiTeam, TeamRole } from '@/lib/teams-api'

function roleFor(team: ApiTeam, userId: string | null): TeamRole | null {
  if (!userId) return null
  const ownerId = typeof team.owner === 'string' ? team.owner : team.owner._id
  if (ownerId === userId) return 'owner'
  return team.members.find((member) =>
    (typeof member.user === 'string' ? member.user : member.user._id) === userId,
  )?.role ?? null
}

function RolePill({ role }: { role: TeamRole | null }) {
  const label = role ? role[0].toUpperCase() + role.slice(1) : 'Role unavailable'
  const roleClass = role === 'owner'
    ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
    : role === 'member'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : role === 'viewer'
        ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
        : 'bg-muted text-muted-foreground'
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleClass}`}>
      {label}
    </span>
  )
}

export default function TeamsPage() {
  const teamsQuery = useTeams()
  const createMutation = useCreateTeam()
  const [userId, setUserId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    const id = getCurrentUserId()
    if (id) window.requestAnimationFrame(() => setUserId(id))
  }, [])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await createMutation.mutateAsync({ name: name.trim(), description: description.trim() })
      setName('')
      setDescription('')
    } catch {
      // Keep the form values so the user can correct or retry.
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-9">
        <header>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Collaboration</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Teams</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            View the teams you belong to and manage your team workspace.
          </p>
        </header>

        <Card className="gap-0 overflow-hidden border-transparent py-0 shadow-sm ring-1 ring-border/70">
          <CardHeader className="w-full border-b border-border/60 bg-gradient-to-r from-primary/[0.09] via-primary/[0.035] to-transparent py-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Plus className="size-4 text-primary" /> Create a team
            </CardTitle>
          </CardHeader>
          <CardContent className="w-full p-5 sm:p-6">
            <form onSubmit={handleCreate} className="grid gap-x-5 gap-y-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)_auto] md:items-end">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="team-name" className="text-xs font-semibold">Team name</Label>
                <Input
                  id="team-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  required
                  placeholder="e.g. Product team"
                  className="h-11 bg-background shadow-sm"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="team-description" className="text-xs font-semibold">Description</Label>
                <Textarea
                  id="team-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={1000}
                  rows={1}
                  placeholder="What does this team work on?"
                  className="h-11 min-h-11 resize-y bg-background py-3 shadow-sm"
                />
              </div>
              <Button type="submit" className="h-11 w-full rounded-lg px-5 shadow-sm shadow-primary/15 md:w-auto" disabled={createMutation.isPending || !name.trim()}>
                {createMutation.isPending ? 'Creating…' : 'Create team'}
              </Button>
            </form>
            {createMutation.isError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {createMutation.error.message}
              </p>
            )}
          </CardContent>
        </Card>

        <section aria-labelledby="your-teams-heading" className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 id="your-teams-heading" className="text-xl font-semibold">Your teams</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your role determines which team settings you can manage.
              </p>
            </div>
            {!teamsQuery.isPending && !teamsQuery.isError && (
              <span className="text-sm text-muted-foreground">{teamsQuery.data.length} teams</span>
            )}
          </div>

          {teamsQuery.isPending ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : teamsQuery.isError ? (
            <Card><CardContent className="flex flex-col items-start gap-3 p-6">
              <p role="alert" className="text-sm text-destructive">{teamsQuery.error.message}</p>
              <Button variant="outline" onClick={() => teamsQuery.refetch()}>Try again</Button>
            </CardContent></Card>
          ) : teamsQuery.data.length === 0 ? (
            <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-center">
              <UsersRound className="mb-3 size-8 text-muted-foreground" />
              <h3 className="font-semibold">No teams yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Create a team to organize work with other people.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {teamsQuery.data.map((team) => {
                const role = roleFor(team, userId)
                return (
                  <Card key={team._id} className="border-transparent shadow-sm ring-1 ring-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold tracking-tight">{team.name}</h3>
                          <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                            {team.description || 'No description added.'}
                          </p>
                        </div>
                        <RolePill role={role} />
                      </div>
                      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
                        <span className="text-sm text-muted-foreground">
                          {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link href={`/dashboard/teams/${team._id}`} />}
                          nativeButton={false}
                        >
                          Open team <ArrowRight className="ml-2 size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
