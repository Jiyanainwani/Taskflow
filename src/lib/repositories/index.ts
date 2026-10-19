import { MockTaskRepository } from './mock-task-repository'
import type { TaskRepository } from './task-repository'

export const taskRepository: TaskRepository =
  new MockTaskRepository()