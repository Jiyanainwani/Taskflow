import { apiRequest } from '@/lib/api-client'

export type ApiTaskStatus = 'todo' | 'in-progress' | 'done'
export type ApiTaskPriority = 'low' | 'medium' | 'high'

export type ApiTask = {
  _id: string
  title: string
  description: string
  status: ApiTaskStatus
  priority: ApiTaskPriority
  dueDate: string | null
  owner: string
  teamId?: string | null
  createdAt: string
  updatedAt: string
}

export type TaskPage = {
  data: ApiTask[]
  hasNextPage: boolean
  nextCursor: string | null
}

export type TaskQuery = {
  cursor?: string
  limit?: number
  status?: ApiTaskStatus
  priority?: ApiTaskPriority
}

export type CreateApiTaskInput = {
  title: string
  description?: string
  status?: ApiTaskStatus
  priority?: ApiTaskPriority
  dueDate?: string | null
  teamId?: string
}

export type UpdateApiTaskInput = Partial<CreateApiTaskInput>

function toQueryString(query: TaskQuery) {
  const params = new URLSearchParams()

  if (query.cursor) params.set('cursor', query.cursor)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  if (query.status) params.set('status', query.status)
  if (query.priority) params.set('priority', query.priority)

  const value = params.toString()
  return value ? `?${value}` : ''
}

export const tasksApi = {
  list(query: TaskQuery = {}) {
    return apiRequest<TaskPage>(`/tasks${toQueryString(query)}`)
  },

  get(id: string) {
    return apiRequest<ApiTask>(`/tasks/${encodeURIComponent(id)}`)
  },

  create(input: CreateApiTaskInput) {
    return apiRequest<ApiTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  update(id: string, input: UpdateApiTaskInput) {
    return apiRequest<ApiTask>(`/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  delete(id: string) {
    return apiRequest<{ message: string }>(`/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}
