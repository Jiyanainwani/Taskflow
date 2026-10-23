export type Task = {
  id: string
  title: string
  description?: string
  completed: boolean
  status?: 'todo' | 'in-progress' | 'done'
  createdAt: string
  updatedAt: string
  owner?: string
  teamId?: string | null
  priority?: 'low' | 'medium' | 'high'
}

export type CreateTaskInput = {
  title: string
  description?: string
}

export type UpdateTaskInput = {
  title?: string
  description?: string
  completed?: boolean
}
