'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarClock, GripVertical, SlidersHorizontal } from 'lucide-react'

import { DeleteTaskButton } from '@/components/tasks/delete-task-button'
import { EditTaskForm } from '@/components/tasks/edit-task-form'
import { TaskCollaborationDialog } from '@/components/tasks/task-collaboration-dialog'
import { ToggleTaskButton } from '@/components/tasks/toggle-task-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useUpdateTask } from '@/lib/task-queries'
import type { ApiTaskPriority, ApiTaskStatus } from '@/lib/tasks-api'
import type { Task } from '@/types/task'

const columns: { status: ApiTaskStatus; title: string; color: string; surface: string; heading: string }[] = [
  { status: 'todo', title: 'To do', color: 'bg-amber-500', surface: 'bg-amber-500/[0.035]', heading: 'bg-amber-500/[0.08]' },
  { status: 'in-progress', title: 'In progress', color: 'bg-sky-500', surface: 'bg-sky-500/[0.035]', heading: 'bg-sky-500/[0.08]' },
  { status: 'done', title: 'Done', color: 'bg-emerald-500', surface: 'bg-emerald-500/[0.035]', heading: 'bg-emerald-500/[0.08]' },
]

type TaskBoardProps = {
  tasks: Task[]
  statusFilter?: ApiTaskStatus
  priorityFilter?: ApiTaskPriority
  onFilterChange: (key: 'status' | 'priority', value: string) => void
  canManage: (task: Task) => boolean
  teamName: (task: Task) => string | undefined
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}

export function TaskBoard({
  tasks,
  statusFilter,
  priorityFilter,
  onFilterChange,
  canManage,
  teamName,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: TaskBoardProps) {
  const updateMutation = useUpdateTask()
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRequestedRef = useRef(false)

  const requestNextPage = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || loadMoreRequestedRef.current) return
    loadMoreRequestedRef.current = true
    onLoadMore()
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  useEffect(() => {
    if (!isFetchingNextPage) loadMoreRequestedRef.current = false
  }, [isFetchingNextPage])

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel || !hasNextPage || isFetchingNextPage || !('IntersectionObserver' in window)) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) requestNextPage()
      },
      { rootMargin: '300px 0px' },
    )
    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, requestNextPage])

  function moveTask(taskId: string, status: ApiTaskStatus) {
    const task = tasks.find((item) => item.id === taskId)
    if (!task || task.status === status || !canManage(task)) return
    updateMutation.mutate({ id: taskId, input: { status } })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm sm:px-4">
        <div className="mr-1 flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground">
          <SlidersHorizontal className="size-4 text-primary" />
          <span>Filters</span>
        </div>
        <label className="sr-only" htmlFor="task-status-filter">Filter by status</label>
          <select
            id="task-status-filter"
            aria-label="Filter tasks by status"
            value={statusFilter ?? ''}
            onChange={(event) => onFilterChange('status', event.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="">All statuses</option>
            {columns.map((column) => <option key={column.status} value={column.status}>{column.title}</option>)}
          </select>
        <label className="sr-only" htmlFor="task-priority-filter">Filter by priority</label>
          <select
            id="task-priority-filter"
            aria-label="Filter tasks by priority"
            value={priorityFilter ?? ''}
            onChange={(event) => onFilterChange('priority', event.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        {(statusFilter || priorityFilter) && (
          <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => {
            onFilterChange('status', '')
            onFilterChange('priority', '')
          }}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="grid min-h-80 gap-4 lg:grid-cols-3">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => (task.status ?? 'todo') === column.status)
          return (
            <section
              key={column.status}
              aria-label={`${column.title} tasks`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const taskId = event.dataTransfer.getData('text/plain')
                if (taskId) moveTask(taskId, column.status)
                setDraggingTaskId(null)
              }}
              className={`min-w-0 rounded-2xl border border-border/60 ${column.surface} p-3 transition-colors ${draggingTaskId ? 'border-dashed border-primary/60 bg-primary/5' : ''}`}
            >
              <header className={`mb-3 flex items-center justify-between rounded-xl ${column.heading} px-3 py-2.5 ring-1 ring-border/40`}>
                <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <span className={`size-2 rounded-full ${column.color} ring-4 ring-background`} />
                  {column.title}
                </h3>
                <span className="min-w-6 rounded-full bg-muted px-2 py-0.5 text-center text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {columnTasks.length}
                </span>
              </header>

              <div className="space-y-3">
                {columnTasks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs leading-5 text-muted-foreground">
                    Drop a task here, or create one to get started.
                  </p>
                ) : columnTasks.map((task) => {
                  const editable = canManage(task)
                  const sharedTeam = teamName(task)
                  return (
                    <Card
                      key={task.id}
                      draggable={editable}
                      onDragStart={(event) => {
                        if (!editable) return
                        event.dataTransfer.setData('text/plain', task.id)
                        event.dataTransfer.effectAllowed = 'move'
                        setDraggingTaskId(task.id)
                      }}
                      onDragEnd={() => setDraggingTaskId(null)}
                      className={`border-transparent bg-card shadow-sm ring-1 ring-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${task.priority === 'high' ? 'border-l-2 border-l-rose-500' : task.priority === 'low' ? 'border-l-2 border-l-slate-400' : 'border-l-2 border-l-amber-400'} ${editable ? 'cursor-grab active:cursor-grabbing' : ''} ${draggingTaskId === task.id ? 'opacity-50' : ''}`}
                    >
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start gap-2">
                          {editable && <GripVertical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0 flex-1">
                            <h4 className={`text-sm font-semibold leading-5 tracking-tight ${task.completed ? 'text-muted-foreground line-through' : ''}`}>{task.title}</h4>
                            {sharedTeam && <p className="mt-1.5 text-[11px] font-medium text-primary">{sharedTeam}{!editable && ' · View only'}</p>}
                            {task.description && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{task.description}</p>}
                            {task.dueDate && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><CalendarClock className="size-3.5" />Due {new Date(task.dueDate).toLocaleString()}</p>}
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${task.priority === 'high' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300' : task.priority === 'low' ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>{task.priority ?? 'medium'}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                          {editable ? (
                            <>
                              <label className="sr-only" htmlFor={`task-status-${task.id}`}>Move {task.title} to status</label>
                              <select
                                id={`task-status-${task.id}`}
                                aria-label={`Move ${task.title} to status`}
                                value={task.status ?? 'todo'}
                                onChange={(event) => moveTask(task.id, event.target.value as ApiTaskStatus)}
                                className="h-8 rounded-lg border border-input bg-background px-2 text-xs shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                              >
                                {columns.map((item) => <option key={item.status} value={item.status}>{item.title}</option>)}
                              </select>
                              <div className="flex items-center gap-1">
                                <ToggleTaskButton taskId={task.id} completed={task.completed} />
                                <EditTaskForm task={task} />
                                <DeleteTaskButton taskId={task.id} />
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Read only</span>
                          )}
                          <TaskCollaborationDialog
                            taskId={task.id}
                            taskTitle={task.title}
                            canComment={editable}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {hasNextPage && (
        <>
          <div ref={loadMoreSentinelRef} aria-hidden="true" className="h-px" />
          <div className="flex flex-col items-center gap-1 pt-1">
            <Button
              variant="outline"
              disabled={isFetchingNextPage}
              onMouseEnter={requestNextPage}
              onFocus={requestNextPage}
              onClick={requestNextPage}
            >
              {isFetchingNextPage ? 'Loading more…' : 'Load more tasks'}
            </Button>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {isFetchingNextPage
                ? 'Loading more tasks…'
                : 'More tasks load as you scroll. You can also hover or focus the button.'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
