import { apiRequest } from '@/lib/api-client'

export type TeamRole = 'owner' | 'member' | 'viewer'

export type ApiTeamUser = {
  _id: string
  name: string
  email: string
}

export type ApiTeamMember = {
  user: string | ApiTeamUser
  role: TeamRole
  joinedAt: string
}

export type ApiTeam = {
  _id: string
  name: string
  description: string
  owner: string | ApiTeamUser
  members: ApiTeamMember[]
  createdAt: string
  updatedAt: string
}

export type TeamInput = {
  name: string
  description?: string
}

export const teamsApi = {
  list() {
    return apiRequest<ApiTeam[]>('/teams')
  },

  get(id: string) {
    return apiRequest<ApiTeam>(`/teams/${encodeURIComponent(id)}`)
  },

  create(input: TeamInput) {
    return apiRequest<ApiTeam>('/teams', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  inviteMember(id: string, input: { email: string; role: Exclude<TeamRole, 'owner'> }) {
    return apiRequest<ApiTeam>(`/teams/${encodeURIComponent(id)}/members`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateMemberRole(
    id: string,
    memberId: string,
    role: Exclude<TeamRole, 'owner'>,
  ) {
    return apiRequest<ApiTeam>(
      `/teams/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`,
      { method: 'PATCH', body: JSON.stringify({ role }) },
    )
  },

  removeMember(id: string, memberId: string) {
    return apiRequest<ApiTeam>(
      `/teams/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`,
      { method: 'DELETE' },
    )
  },

  delete(id: string) {
    return apiRequest<{ message: string }>(`/teams/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}
