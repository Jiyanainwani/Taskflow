'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { projectsApi } from '@/lib/projects-api'
import { teamsApi } from '@/lib/teams-api'

export const workspaceQueryKeys = {
  teams: ['teams'] as const,
  team: (id: string) => ['teams', id] as const,
  projects: ['projects'] as const,
}

export function useTeams() {
  return useQuery({
    queryKey: workspaceQueryKeys.teams,
    queryFn: teamsApi.list,
    staleTime: 60_000,
  })
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: workspaceQueryKeys.team(id),
    queryFn: () => teamsApi.get(id),
    enabled: Boolean(id),
    staleTime: 60_000,
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.teams }),
  })
}

export function useInviteTeamMember(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof teamsApi.inviteMember>[1]) =>
      teamsApi.inviteMember(teamId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.teams })
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.team(teamId) })
    },
  })
}

export function useUpdateTeamMemberRole(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string
      role: Parameters<typeof teamsApi.updateMemberRole>[2]
    }) => teamsApi.updateMemberRole(teamId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.teams })
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.team(teamId) })
    },
  })
}

export function useRemoveTeamMember(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => teamsApi.removeMember(teamId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.teams })
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.team(teamId) })
    },
  })
}

export function useDeleteTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: teamsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.teams }),
  })
}

export function useProjects() {
  return useQuery({
    queryKey: workspaceQueryKeys.projects,
    queryFn: projectsApi.list,
    staleTime: 60_000,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.projects }),
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Parameters<typeof projectsApi.update>[1]
    }) => projectsApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.projects }),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.projects }),
  })
}
