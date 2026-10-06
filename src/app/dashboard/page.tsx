import {
  CheckCircle2,
  Circle,
  Clock3,
  ListTodo,
} from 'lucide-react'

import { CreateTaskForm } from '@/components/tasks/create-task-form'
import { EditTaskForm } from '@/components/tasks/edit-task-form'
import { DeleteTaskButton } from '@/components/tasks/delete-task-button'
import { CommandPalette } from '@/components/command-palette'
import { ThemeToggle } from '@/components/theme-toggle'
import { Card, CardContent } from '@/components/ui/card'
import { taskRepository } from '@/lib/repositories'
import { ToggleTaskButton } from '@/components/tasks/toggle-task-button'
export default async function DashboardPage() {
  const tasks = await taskRepository.getTasks()

  const completedTasks = tasks.filter((task) => task.completed).length
  const pendingTasks = tasks.filter((task) => !task.completed).length

  const stats = [
    {
      title: 'Total Tasks',
      value: tasks.length,
      icon: ListTodo,
      description: 'All tasks in your workspace',
      className: 'text-primary bg-primary/10',
    },
    {
      title: 'Completed',
      value: completedTasks,
      icon: CheckCircle2,
      description: 'Tasks completed successfully',
      className: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      title: 'Pending',
      value: pendingTasks,
      icon: Clock3,
      description: 'Tasks still to be completed',
      className: 'text-amber-500 bg-amber-500/10',
    },
  ]

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <CommandPalette />

        {/* Header */}
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Dashboard
            </h1>

            <p className="mt-2 text-base text-muted-foreground sm:text-lg">
              Welcome back to TaskFlow. Manage your tasks and keep track of
              your progress.
            </p>
          </div>

          <ThemeToggle />
        </header>

        {/* Stats */}
        <section className="mb-8 grid gap-4 md:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon

            return (
              <Card
                key={stat.title}
                className="overflow-hidden border-border/60 bg-card/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <CardContent className="flex items-center gap-5 p-5 sm:p-6">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${stat.className}`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>

                    <p className="mt-1 text-3xl font-bold tracking-tight">
                      {stat.value}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>

        {/* Create task */}
        <section className="mb-8">
          <CreateTaskForm />
        </section>

        {/* Tasks */}
        <section>
          <div className="mb-5 flex items-end justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ListTodo className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Tasks
                </h2>

                <p className="text-sm text-muted-foreground sm:text-base">
                  Your tasks and progress.
                </p>
              </div>
            </div>

            <div className="hidden text-sm text-muted-foreground sm:block">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </div>
          </div>

          {tasks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Circle className="h-7 w-7 text-muted-foreground" />
                </div>

                <h3 className="text-lg font-semibold">
                  No tasks yet
                </h3>

                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Create your first task above to start organizing your
                  work.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className="border-border/60 bg-card/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex min-w-0 items-start gap-4">
                      <ToggleTaskButton
  taskId={task.id}
  completed={task.completed}
/>

                      <div className="min-w-0">
                        <h3
                          className={`text-base font-semibold sm:text-lg ${
                            task.completed
                              ? 'text-muted-foreground line-through'
                              : ''
                          }`}
                        >
                          {task.title}
                        </h3>

                        {task.description && (
                          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          task.completed
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-amber-500/10 text-amber-500'
                        }`}
                      >
                        {task.completed ? 'Completed' : 'Pending'}
                      </span>

                      <EditTaskForm task={task} />

                      <DeleteTaskButton taskId={task.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}