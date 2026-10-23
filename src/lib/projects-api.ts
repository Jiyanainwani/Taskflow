import { apiRequest } from '@/lib/api-client'

export type ApiProject = {
  _id: string
  name: string
  description: string
  owner: string
  createdAt: string
  updatedAt: string
}

export type ProjectInput = {
  name: string
  description?: string
}

export const projectsApi = {
  list() {
    return apiRequest<ApiProject[]>('/projects')
  },

  create(input: ProjectInput) {
    return apiRequest<ApiProject>('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  update(id: string, input: Partial<ProjectInput>) {
    return apiRequest<ApiProject>(`/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  delete(id: string) {
    return apiRequest<{ message: string }>(`/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}
