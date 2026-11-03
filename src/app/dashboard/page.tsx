'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, CheckCircle2, Clock3, ListTodo, Sparkles } from 'lucide-react'

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
    dueDate: apiTask.dueDate,
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
  const inProgressTasks = tasks.filter((task) => task.status === 'in-progress').length

  const stats = [
    {
      title: 'Tasks in view',
      value: tasks.length,
      icon: ListTodo,
      description: 'Across your workspace',
      className: 'text-indigo-700 bg-indigo-500/10 dark:text-indigo-300',
    },
    {
      title: 'Completed',
      value: completedTasks,
      icon: CheckCircle2,
      description: 'Good work adds up',
      className: 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-300',
    },
    {
      title: 'In progress',
      value: inProgressTasks,
      icon: Clock3,
      description: 'Moving forward now',
      className: 'text-sky-700 bg-sky-500/10 dark:text-sky-300',
    },
  ]

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto w-full max-w-[1500px]">
        <header className="relative mb-8 overflow-hidden rounded-3xl bg-[linear-gradient(120deg,oklch(0.37_0.14_265)_0%,oklch(0.48_0.2_272)_54%,oklch(0.56_0.18_250)_100%)] px-6 py-7 text-white shadow-[0_24px_60px_-32px_oklch(0.35_0.18_265_/_0.7)] sm:px-8 sm:py-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 size-80 rounded-full border border-white/10 bg-white/[0.04]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-14 size-56 rounded-full border border-white/10" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
                <Sparkles className="size-3.5" /> TaskFlow workspace
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Make progress, one task at a time.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
                Your team’s priorities, updates, and next steps — all in one place.
              </p>
            </div>
            <Button
              type="button"
              className="h-10 gap-2 rounded-lg bg-white px-4 font-semibold text-primary shadow-sm hover:bg-white/90"
              onClick={() => document.getElementById('title')?.focus()}
            >
              Create a task <ArrowDown className="size-4" />
            </Button>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3" aria-label="Task summary">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card
                key={stat.title}
                className="group overflow-hidden border-transparent bg-card/95 shadow-sm ring-1 ring-border/70 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
              >
                <CardContent className="flex items-center gap-4 p-5 sm:p-6">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.className}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{stat.title}</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums transition-colors group-hover:text-primary">{stat.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>

        <section id="new-task" className="mb-10">
          <CreateTaskForm />
        </section>

        <section id="tasks" aria-labelledby="tasks-heading">
          <div className="mb-5 flex items-end justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ListTodo className="h-5 w-5" />
              </div>
              <div>
                <h2 id="tasks-heading" className="text-xl font-semibold tracking-tight">
                  Tasks
                </h2>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Keep the next steps moving.
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
