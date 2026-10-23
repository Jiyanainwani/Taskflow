'use client'

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { tasksApi, type ApiTask, type TaskPage, type TaskQuery } from '@/lib/tasks-api'

export const taskQueryKeys = {
  all: ['tasks'] as const,
  pages: (filters: Pick<TaskQuery, 'status' | 'priority'> = {}) =>
    [...taskQueryKeys.all, 'pages', filters] as const,
}

export function useTaskPages(
  filters: Pick<TaskQuery, 'status' | 'priority'> = {},
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: taskQueryKeys.pages(filters),
    queryFn: ({ pageParam }) => tasksApi.list({ ...filters, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? (lastPage.nextCursor ?? undefined) : undefined,
    staleTime: 10_000,
    enabled,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all }),
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Parameters<typeof tasksApi.update>[1]
    }) => tasksApi.update(id, input),
    onMutate: async ({ id, input }) => {
      const pagesKey = [...taskQueryKeys.all, 'pages'] as const
      await queryClient.cancelQueries({ queryKey: pagesKey })
      const previous = queryClient.getQueriesData<InfiniteData<TaskPage>>({
        queryKey: pagesKey,
      })

      for (const [queryKey, data] of previous) {
        if (!data) continue
        const filters = (queryKey[2] ?? {}) as Pick<TaskQuery, 'status' | 'priority'>
        queryClient.setQueryData<InfiniteData<TaskPage>>(queryKey, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            data: page.data.flatMap((task) => {
              if (task._id !== id) return [task]
              const updated: ApiTask = { ...task, ...input }
              if (filters.status && updated.status !== filters.status) return []
              if (filters.priority && updated.priority !== filters.priority) return []
              return [updated]
            }),
          })),
        })
      }

      return { previous }
    },
    onError: (error, variables, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
      })
      if (variables.input.status !== undefined) {
        toast.error(error.message || 'Could not move task. The change was reverted.')
      }
    },
    onSuccess: (_task, { input }) => {
      if (input.status !== undefined) toast.success('Task moved')
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all }),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all }),
  })
}
