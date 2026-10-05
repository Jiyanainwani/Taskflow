import type {
  CreateTaskInput,
  Task,
  UpdateTaskInput,
} from "@/types/task"

export interface TaskRepository {
  getTasks(): Promise<Task[]>

  getTask(id: string): Promise<Task | null>

  createTask(input: CreateTaskInput): Promise<Task>

  updateTask(
    id: string,
    input: UpdateTaskInput,
  ): Promise<Task | null>

  deleteTask(id: string): Promise<boolean>
}