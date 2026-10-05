export type Task = {
  id: string
  title: string
  description?: string
  completed: boolean
  createdAt: string
  updatedAt: string
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