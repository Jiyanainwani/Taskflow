import { apiRequest } from '@/lib/api-client'

export type TaskCollaborationUser = {
  _id: string
  name: string
  email: string
}

export type TaskComment = {
  _id: string
  taskId: string
  author: TaskCollaborationUser | string
  body: string
  createdAt: string
}

export type TaskActivity = {
  _id: string
  taskId: string
  actor: TaskCollaborationUser | string
  action: 'created' | 'updated' | 'status_changed' | 'comment_added'
  summary: string
  createdAt: string
}

export const taskCollaborationApi = {
  listComments(taskId: string) {
    return apiRequest<TaskComment[]>(`/tasks/${encodeURIComponent(taskId)}/comments`)
  },

  createComment(taskId: string, body: string) {
    return apiRequest<TaskComment>(`/tasks/${encodeURIComponent(taskId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
  },

  listActivity(taskId: string) {
    return apiRequest<TaskActivity[]>(`/tasks/${encodeURIComponent(taskId)}/activity`)
  },
}
