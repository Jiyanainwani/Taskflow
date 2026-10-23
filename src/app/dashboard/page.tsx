'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, ListTodo } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { CreateTaskForm } from '@/components/tasks/create-task-form'
import { TaskBoard } from '@/components/tasks/task-board'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTaskPages } from '@/lib/task-queries'
import { useTeams } from '@/lib/workspace-queries'
import { getCurrentUserId } from '@/lib/auth'
import type { ApiTeam } from '@/lib/teams-api'
import type { ApiTask, ApiTaskPriority, ApiTaskStatus } from '@/lib/tasks-api'
import type { Task } from '@/types/task'

function toDashboardTask(apiTask: ApiTask): Task {
  return {
    id: apiTask._id,
    title: apiTask.title,
    description: apiTask.description,
    completed: apiTask.status === 'done',
    status: apiTask.status,
    createdAt: apiTask.createdAt,
    updatedAt: apiTask.updatedAt,
    owner: apiTask.owner,
    teamId: apiTask.teamId,
    priority: apiTask.priority,
  }
}

type DashboardFilters = {
  status?: ApiTaskStatus
  priority?: ApiTaskPriority
}

function canManageTask(task: Task, userId: string | null, teams: ApiTeam[] | undefined) {
  if (!task.owner) return false
  if (!task.teamId) return task.owner === userId
  if (!userId || !teams) return false

  const team = teams.find((item) => item._id === task.teamId)
  if (!team) return false
  const ownerId = typeof team.owner === 'string' ? team.owner : team.owner._id
  if (ownerId === userId) return true
  const membership = team.members.find((member) =>
    (typeof member.user === 'string' ? member.user : member.user._id) === userId,
  )
  return membership?.role === 'member'
}

function TaskListSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading tasks">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-xl border border-border/60 bg-muted/50"
        />
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>({})
  const [filtersReady, setFiltersReady] = useState(false)
  const query = useTaskPages(filters, filtersReady)
  const teamsQuery = useTeams()
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    const id = getCurrentUserId()
    if (id) window.requestAnimationFrame(() => setUserId(id))
  }, [])
  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      const status = params.get('status')
      const priority = params.get('priority')
      setFilters({
        status: status === 'todo' || status === 'in-progress' || status === 'done' ? status : undefined,
        priority: priority === 'low' || priority === 'medium' || priority === 'high' ? priority : undefined,
      })
    }
    syncFromUrl()
    const readyFrame = window.requestAnimationFrame(() => setFiltersReady(true))
    window.addEventListener('popstate', syncFromUrl)
    return () => {
      window.cancelAnimationFrame(readyFrame)
      window.removeEventListener('popstate', syncFromUrl)
    }
  }, [])

  function updateFilter(key: 'status' | 'priority', value: string) {
    const params = new URLSearchParams(window.location.search)
    if (value) params.set(key, value)
    else params.delete(key)
    const search = params.toString()
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
    window.history.pushState(null, '', nextUrl)
    setFilters((current) => ({ ...current, [key]: value || undefined }))
  }
  const tasks = useMemo(
    () => query.data?.pages.flatMap((page) => page.data.map(toDashboardTask)) ?? [],
    [query.data],
  )

  const completedTasks = tasks.filter((task) => task.completed).length
  const openTasks = tasks.length - completedTasks

  const stats = [
    {
      title: 'Tasks loaded',
      value: tasks.length,
      icon: ListTodo,
      description: 'Tasks fetched from your workspace',
      className: 'text-primary bg-primary/10',
    },
    {
      title: 'Completed',
      value: completedTasks,
      icon: CheckCircle2,
      description: 'Tasks marked done',
      className: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      title: 'Open',
      value: openTasks,
      icon: Clock3,
      description: 'Tasks not marked done',
      className: 'text-amber-500 bg-amber-500/10',
    },
  ]

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Dashboard
            </h1>
            <p className="mt-2 text-base text-muted-foreground sm:text-lg">
              Welcome back to TaskFlow. Manage your tasks and keep track of your progress.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3" aria-label="Task summary">
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
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight">{stat.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>

        <section id="new-task" className="mb-8">
          <CreateTaskForm />
        </section>

        <section id="tasks" aria-labelledby="tasks-heading">
          <div className="mb-5 flex items-end justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ListTodo className="h-6 w-6" />
              </div>
              <div>
                <h2 id="tasks-heading" className="text-2xl font-bold tracking-tight">
                  Tasks
                </h2>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Your tasks and progress.
                </p>
              </div>
            </div>
            {!query.isPending && !query.isError && (
              <div className="hidden text-sm text-muted-foreground sm:block">
                {tasks.length} loaded {tasks.length === 1 ? 'task' : 'tasks'}
              </div>
            )}
          </div>

          {query.isPending ? (
            <TaskListSkeleton />
          ) : query.isError && !query.data ? (
            <Card className="border-destructive/40">
              <CardContent className="flex flex-col items-start gap-3 p-6">
                <p className="font-medium">We couldn’t load your tasks.</p>
                <p role="alert" className="text-sm text-muted-foreground">
                  {query.error.message}
                </p>
                <Button onClick={() => query.refetch()} disabled={query.isRefetching}>
                  {query.isRefetching ? 'Retrying…' : 'Try again'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {tasks.length === 0 && !filters.status && !filters.priority && (
                <p className="mb-4 text-sm text-muted-foreground">No tasks yet. Create a task above to get started.</p>
              )}
              <TaskBoard
                tasks={tasks}
                statusFilter={filters.status}
                priorityFilter={filters.priority}
                onFilterChange={updateFilter}
                canManage={(task) => canManageTask(task, userId, teamsQuery.data)}
                teamName={(task) => task.teamId ? teamsQuery.data?.find((team) => team._id === task.teamId)?.name : undefined}
                hasNextPage={query.hasNextPage}
                isFetchingNextPage={query.isFetchingNextPage}
                onLoadMore={() => { void query.fetchNextPage() }}
              />
              {query.isFetchNextPageError && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  Couldn’t load more tasks: {query.error.message}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
