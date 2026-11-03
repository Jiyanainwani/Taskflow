'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { taskCollaborationApi } from '@/lib/task-collaboration-api'

export const taskCollaborationQueryKeys = {
  comments: (taskId: string) => ['tasks', taskId, 'comments'] as const,
  activity: (taskId: string) => ['tasks', taskId, 'activity'] as const,
}

export function useTaskComments(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: taskCollaborationQueryKeys.comments(taskId),
    queryFn: () => taskCollaborationApi.listComments(taskId),
    staleTime: 0,
    enabled,
  })
}

export function useTaskActivity(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: taskCollaborationQueryKeys.activity(taskId),
    queryFn: () => taskCollaborationApi.listActivity(taskId),
    staleTime: 0,
    enabled,
  })
}

export function useCreateTaskComment(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: string) => taskCollaborationApi.createComment(taskId, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: taskCollaborationQueryKeys.comments(taskId),
        }),
        queryClient.invalidateQueries({
          queryKey: taskCollaborationQueryKeys.activity(taskId),
        }),
      ])
    },
  })
}
