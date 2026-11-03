'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { io } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'

import { getAccessToken, refreshAccessToken } from '@/lib/auth'
import { taskQueryKeys } from '@/lib/task-queries'
import { taskCollaborationQueryKeys } from '@/lib/task-collaboration-queries'
import { API_ORIGIN } from '@/lib/api-url'

type TaskRealtimeEvent = {
  type: 'task.created' | 'task.updated' | 'task.deleted' | 'task.comment.added'
  taskId: string
  occurredAt: string
}

export function TaskRealtimeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    const token = getAccessToken()
    if (!token) return

    const socket = io(API_ORIGIN, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
    })
    let refreshing = false

    socket.on('taskflow.event', (event: TaskRealtimeEvent) => {
      if (!event || typeof event.taskId !== 'string') return

      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.all })
      if (event.type === 'task.comment.added') {
        void Promise.all([
          queryClient.invalidateQueries({
            queryKey: taskCollaborationQueryKeys.comments(event.taskId),
          }),
          queryClient.invalidateQueries({
            queryKey: taskCollaborationQueryKeys.activity(event.taskId),
          }),
        ])
      }
    })

    socket.on('disconnect', (reason) => {
      if (reason !== 'io server disconnect' || refreshing) return
      refreshing = true
      void refreshAccessToken()
        .then((freshToken) => {
          socket.auth = { token: freshToken }
          socket.connect()
        })
        .catch(() => {
          router.replace('/auth/login')
        })
        .finally(() => {
          refreshing = false
        })
    })

    return () => {
      socket.disconnect()
    }
  }, [queryClient, router])

  return children
}
