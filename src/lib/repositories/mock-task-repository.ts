import type {
  CreateTaskInput,
  Task,
  UpdateTaskInput,
} from "@/types/task"

import type { TaskRepository } from "./task-repository"

let tasks: Task[] = [
  {
    id: "1",
    title: "Learn TypeScript",
    description: "Learn generics, utility types and narrowing.",
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Build TaskFlow",
    description: "Build the Week 1 TaskFlow dashboard.",
    completed: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    title: "Learn Server Components",
    description: "Understand Server and Client Components.",
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export class MockTaskRepository implements TaskRepository {
  async getTasks(): Promise<Task[]> {
    return tasks
  }

  async getTask(id: string): Promise<Task | null> {
    return tasks.find((task) => task.id === id) ?? null
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const now = new Date().toISOString()

    const task: Task = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      completed: false,
      createdAt: now,
      updatedAt: now,
    }

    tasks.push(task)

    return task
  }

  async updateTask(
    id: string,
    input: UpdateTaskInput,
  ): Promise<Task | null> {
    const task = tasks.find((task) => task.id === id)

    if (!task) {
      return null
    }

    Object.assign(task, input, {
      updatedAt: new Date().toISOString(),
    })

    return task
  }

  async deleteTask(id: string): Promise<boolean> {
    const initialLength = tasks.length

    tasks = tasks.filter((task) => task.id !== id)

    return tasks.length < initialLength
  }
}