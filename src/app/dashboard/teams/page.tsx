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
  return (
    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
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
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header>
          <p className="text-sm font-medium text-primary">Workspace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Teams</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            View the teams you belong to and manage your team workspace.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="size-5 text-primary" /> Create a team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team name</Label>
                <Input
                  id="team-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  required
                  placeholder="e.g. Product team"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-description">Description</Label>
                <Textarea
                  id="team-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={1000}
                  rows={1}
                  placeholder="What does this team work on?"
                />
              </div>
              <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
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
                  <Card key={team._id} className="transition-shadow hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold">{team.name}</h3>
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
