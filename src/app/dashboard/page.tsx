import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { taskRepository } from '@/lib/repositories'
import { CreateTaskForm } from '@/components/tasks/create-task-form'
import { EditTaskForm } from '@/components/tasks/edit-task-form'
import { DeleteTaskButton } from '@/components/tasks/delete-task-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { CommandPalette } from '@/components/command-palette'

export default async function DashboardPage() {
  const tasks = await taskRepository.getTasks()

  const completedTasks = tasks.filter((task) => task.completed).length
  const pendingTasks = tasks.filter((task) => !task.completed).length

  const stats = [
    { title: 'Total Tasks', value: tasks.length },
    { title: 'Completed', value: completedTasks },
    { title: 'Pending', value: pendingTasks },
  ]

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6">
  <div className="mx-auto w-full max-w-7xl">
      <CommandPalette />

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Dashboard
          </h1>

          <p className="text-muted-foreground">Welcome back to TaskFlow.</p>
        </div>

        <ThemeToggle />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}   className="border-border/60 shadow-sm"
>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">Tasks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your tasks and keep track of your progress.
          </p>
        </div>

        <div className="mb-8">
          <CreateTaskForm />
        </div>
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <h3 className="text-lg font-semibold">No tasks yet</h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Create your first task to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <Card
                key={task.id}
                className="border-border/60 shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-medium">{task.title}</h3>

                    {task.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        task.completed
                          ? 'rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400'
                          : 'rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-600 dark:text-yellow-400'
                      }
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
