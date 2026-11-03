'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiRequest } from '@/lib/api-client'
import {
  checkReminderAdminAccess,
  reminderAdminAccessQueryKey,
} from '@/lib/reminder-admin-api'
import { getCurrentUserId } from '@/lib/auth'

type FailedReminder = {
  id: string
  taskId: string
  dueAt: string
  failedAt: string
  attemptsMade: number
  reason: string
}

const adminDeniedMessage = 'This view is restricted to TaskFlow administrators'

export default function FailedRemindersPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const userId = getCurrentUserId()
  const queryKey = ['admin', 'reminders', 'dead-letters', userId] as const
  const access = useQuery({
    queryKey: reminderAdminAccessQueryKey(userId),
    queryFn: checkReminderAdminAccess,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const isAdminDenied =
    access.error instanceof Error &&
    access.error.message.includes(adminDeniedMessage)

  useEffect(() => {
    if (isAdminDenied) router.replace('/dashboard')
  }, [isAdminDenied, router])

  const reminders = useQuery({
    queryKey,
    queryFn: () =>
      apiRequest<FailedReminder[]>('/admin/reminders/dead-letters'),
    enabled: access.isSuccess && access.data?.isAdmin === true,
  })
  const retry = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ message: string }>(
        `/admin/reminders/dead-letters/${encodeURIComponent(id)}/retry`,
        {
          method: 'POST',
        },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  if (access.isPending || access.isFetching || isAdminDenied) return null
  if (access.isError) {
    return (
      <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
        <p role="alert" className="text-sm text-destructive">
          Could not check administrator access. Try again.
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Failed reminders
            </h1>
            <p className="mt-2 text-muted-foreground">
              Reminders that exhausted their automatic delivery retries.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void reminders.refetch()}
            disabled={reminders.isRefetching}
          >
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </header>

        {reminders.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading failed reminders…
          </p>
        ) : reminders.isError ? (
          <Card className="border-destructive/40">
            <CardContent className="p-5">
              <p role="alert" className="text-sm text-destructive">
                {reminders.error.message}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                This page is available only to user IDs listed in
                TASKFLOW_ADMIN_USER_IDS.
              </p>
            </CardContent>
          </Card>
        ) : reminders.data.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
              <BellRing className="size-5" />
              No failed reminders.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reminders.data.map((reminder) => (
              <Card key={reminder.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                  <CardTitle className="text-base">
                    Task {reminder.taskId}
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => retry.mutate(reminder.id)}
                    disabled={retry.isPending}
                  >
                    Retry reminder
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>Due: {new Date(reminder.dueAt).toLocaleString()}</p>
                  <p>Failed: {new Date(reminder.failedAt).toLocaleString()}</p>
                  <p>Attempts: {reminder.attemptsMade}</p>
                  <p className="break-words text-destructive">
                    Reason: {reminder.reason}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {retry.isError && (
          <p role="alert" className="text-sm text-destructive">
            {retry.error.message}
          </p>
        )}
        {retry.isSuccess && (
          <p role="status" className="text-sm text-emerald-600">
            {retry.data.message}
          </p>
        )}
      </div>
    </main>
  )
}
