'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Shield, UserPlus, UsersRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTeam, useDeleteTeam, useInviteTeamMember, useRemoveTeamMember, useUpdateTeamMemberRole } from '@/lib/workspace-queries'
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

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const router = useRouter()
  const query = useTeam(teamId)
  const inviteMutation = useInviteTeamMember(teamId)
  const updateRoleMutation = useUpdateTeamMemberRole(teamId)
  const removeMutation = useRemoveTeamMember(teamId)
  const deleteMutation = useDeleteTeam()
  const [userId, setUserId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member')

  useEffect(() => {
    const id = getCurrentUserId()
    if (id) window.requestAnimationFrame(() => setUserId(id))
  }, [])

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await inviteMutation.mutateAsync({ email: inviteEmail.trim().toLowerCase(), role: inviteRole })
      setInviteEmail('')
    } catch {
      // Keep the form values so the owner can correct or retry.
    }
  }

  function handleDeleteTeam() {
    if (!query.data || !window.confirm(`Delete the team “${query.data.name}”?`)) return
    deleteMutation.mutate(query.data._id, {
      onSuccess: () => router.replace('/dashboard/teams'),
    })
  }

  if (query.isPending) {
    return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8"><div className="h-48 animate-pulse rounded-xl bg-muted" /></main>
  }

  if (query.isError) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
        <Card><CardContent className="flex flex-col items-start gap-3 p-6">
          <p role="alert" className="text-sm text-destructive">{query.error.message}</p>
          <Button variant="outline" onClick={() => router.push('/dashboard/teams')}>Back to teams</Button>
        </CardContent></Card>
      </main>
    )
  }

  const team = query.data
  const role = roleFor(team, userId)
  const canManage = role === 'owner'

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Button
          variant="ghost"
          render={<Link href="/dashboard/teams" />}
          nativeButton={false}
          className="-ml-3"
        >
          <ArrowLeft className="mr-2 size-4" /> Teams
        </Button>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <UsersRound className="size-4" /> Team workspace
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{team.name}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {team.description || 'No description added.'}
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium capitalize text-primary">
            {role ?? 'Role unavailable'}
          </span>
        </header>

        {!canManage && (
          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
            <Shield className="mt-0.5 size-4 shrink-0" />
            <p>
              You can view this team as a {role ?? 'team member'}. Only the team owner can invite people or change membership settings.
            </p>
          </div>
        )}

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="size-5 text-primary" /> Invite a member
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Account email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="person@example.com"
                    required
                  />
                  <p className="text-xs text-muted-foreground">The person must already have a TaskFlow account.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as 'member' | 'viewer')}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <Button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim()}>
                  {inviteMutation.isPending ? 'Inviting…' : 'Invite'}
                </Button>
              </form>
              {inviteMutation.isError && <p role="alert" className="mt-3 text-sm text-destructive">{inviteMutation.error.message}</p>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-4">
              <span>Members <span className="ml-1 text-sm font-normal text-muted-foreground">{team.members.length}</span></span>
              {canManage && (
                <Button variant="destructive" size="sm" onClick={handleDeleteTeam} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete team'}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {team.members.map((member) => {
              const memberId = typeof member.user === 'string' ? member.user : member.user._id
              const memberName = typeof member.user === 'string' ? null : member.user.name
              const memberEmail = typeof member.user === 'string' ? null : member.user.email
              const ownerId = typeof team.owner === 'string' ? team.owner : team.owner._id
              const isOwner = memberId === ownerId || member.role === 'owner'
              const isCurrentUser = memberId === userId
              return (
                <div key={memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {isCurrentUser ? 'You' : memberName || memberEmail || `User ${memberId.slice(-6)}`}
                      {isOwner && <span className="ml-2 text-xs text-muted-foreground">Owner</span>}
                    </p>
                    {memberEmail && <p className="mt-1 truncate text-xs text-muted-foreground">{memberEmail}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && !isOwner ? (
                      <select
                        aria-label={`Role for ${memberEmail || memberName || 'team member'}`}
                        value={member.role}
                        disabled={updateRoleMutation.isPending}
                        onChange={(event) => updateRoleMutation.mutate({ memberId, role: event.target.value as 'member' | 'viewer' })}
                        className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                      >
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize text-muted-foreground">{member.role}</span>
                    )}
                    {canManage && !isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={removeMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Remove ${memberEmail || memberName || 'this member'} from the team?`)) removeMutation.mutate(memberId)
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
            {(updateRoleMutation.isError || removeMutation.isError || deleteMutation.isError) && (
              <p role="alert" className="text-sm text-destructive">
                {updateRoleMutation.error?.message ?? removeMutation.error?.message ?? deleteMutation.error?.message}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
