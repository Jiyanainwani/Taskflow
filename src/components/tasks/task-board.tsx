'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'

import { DeleteTaskButton } from '@/components/tasks/delete-task-button'
import { EditTaskForm } from '@/components/tasks/edit-task-form'
import { ToggleTaskButton } from '@/components/tasks/toggle-task-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useUpdateTask } from '@/lib/task-queries'
import type { ApiTaskPriority, ApiTaskStatus } from '@/lib/tasks-api'
import type { Task } from '@/types/task'

const columns: { status: ApiTaskStatus; title: string; color: string }[] = [
  { status: 'todo', title: 'To do', color: 'bg-amber-500' },
  { status: 'in-progress', title: 'In progress', color: 'bg-sky-500' },
  { status: 'done', title: 'Done', color: 'bg-emerald-500' },
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
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            aria-label="Filter tasks by status"
            value={statusFilter ?? ''}
            onChange={(event) => onFilterChange('status', event.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3"
          >
            <option value="">All statuses</option>
            {columns.map((column) => <option key={column.status} value={column.status}>{column.title}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Priority</span>
          <select
            aria-label="Filter tasks by priority"
            value={priorityFilter ?? ''}
            onChange={(event) => onFilterChange('priority', event.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3"
          >
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {(statusFilter || priorityFilter) && (
            <Button variant="ghost" size="sm" onClick={() => {
              onFilterChange('status', '')
              onFilterChange('priority', '')
            }}>
              Clear filters
            </Button>
          )}
        </label>
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
              className={`min-w-0 rounded-2xl border border-border/70 bg-muted/30 p-3 transition-colors ${draggingTaskId ? 'border-dashed border-primary/60 bg-primary/5' : ''}`}
            >
              <header className="mb-3 flex items-center justify-between px-1 py-1">
                <h3 className="flex items-center gap-2 font-semibold">
                  <span className={`size-2.5 rounded-full ${column.color}`} />
                  {column.title}
                </h3>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  {columnTasks.length}
                </span>
              </header>

              <div className="space-y-3">
                {columnTasks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/70 px-3 py-7 text-center text-sm text-muted-foreground">
                    Drop tasks here
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
                      className={`border-border/70 bg-card shadow-sm ${editable ? 'cursor-grab active:cursor-grabbing' : ''} ${draggingTaskId === task.id ? 'opacity-50' : ''}`}
                    >
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start gap-2">
                          {editable && <GripVertical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0 flex-1">
                            <h4 className={`font-medium ${task.completed ? 'text-muted-foreground line-through' : ''}`}>{task.title}</h4>
                            {sharedTeam && <p className="mt-1 text-xs font-medium text-primary">{sharedTeam}{!editable && ' · Read only'}</p>}
                            {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}
                          </div>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-medium capitalize text-muted-foreground">{task.priority ?? 'medium'}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                          {editable ? (
                            <>
                              <label className="sr-only" htmlFor={`task-status-${task.id}`}>Move {task.title} to status</label>
                              <select
                                id={`task-status-${task.id}`}
                                aria-label={`Move ${task.title} to status`}
                                value={task.status ?? 'todo'}
                                onChange={(event) => moveTask(task.id, event.target.value as ApiTaskStatus)}
                                className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
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
