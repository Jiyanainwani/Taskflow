'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileText, LoaderCircle, Paperclip, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { taskAttachmentsApi, type TaskAttachment } from '@/lib/task-attachments-api'

const MAX_SIZE = 10 * 1024 * 1024
const queryKey = (taskId: string) => ['tasks', taskId, 'attachments'] as const

function formatSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function TaskAttachmentsPanel({
  taskId,
  enabled,
  canManage,
}: {
  taskId: string
  enabled: boolean
  canManage: boolean
}) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const attachmentsQuery = useQuery({
    queryKey: queryKey(taskId),
    queryFn: () => taskAttachmentsApi.list(taskId),
    enabled,
  })
  const uploadMutation = useMutation({
    mutationFn: (file: File) => taskAttachmentsApi.upload(taskId, file),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: queryKey(taskId) }),
  })
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => taskAttachmentsApi.remove(taskId, attachmentId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: queryKey(taskId) }),
  })

  async function uploadFile(file?: File) {
    if (!file) return
    setError(null)
    if (file.size > MAX_SIZE) {
      setError('Files must be smaller than 10 MB.')
      return
    }
    try {
      await uploadMutation.mutateAsync(file)
      if (inputRef.current) inputRef.current.value = ''
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload this file.')
    }
  }

  async function download(attachment: TaskAttachment) {
    setError(null)
    try {
      await taskAttachmentsApi.download(taskId, attachment)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download this file.')
    }
  }

  async function remove(attachmentId: string) {
    setError(null)
    try {
      await deleteMutation.mutateAsync(attachmentId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this file.')
    }
  }

  return (
    <section aria-labelledby={`attachments-heading-${taskId}`} className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`attachments-heading-${taskId}`} className="flex items-center gap-2 font-semibold">
          <Paperclip aria-hidden="true" className="size-4" /> Attachments
        </h3>
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Choose an attachment"
              disabled={uploadMutation.isPending}
              onChange={(event) => void uploadFile(event.currentTarget.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadMutation.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {uploadMutation.isPending ? <LoaderCircle className="mr-1.5 size-4 animate-spin" /> : <Upload className="mr-1.5 size-4" />}
              {uploadMutation.isPending ? 'Uploading…' : 'Upload file'}
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">PDF, JPEG, PNG, or WebP · maximum 10 MB</p>

      {attachmentsQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading attachments…</p>
      ) : attachmentsQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">{attachmentsQuery.error.message}</p>
      ) : attachmentsQuery.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachmentsQuery.data.map((attachment) => (
            <li key={attachment._id} className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/40 p-2">
              <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm" title={attachment.filename}>{attachment.filename}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatSize(attachment.size)}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Download ${attachment.filename}`} onClick={() => void download(attachment)}>
                <Download aria-hidden="true" />
              </Button>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${attachment.filename}`}
                  disabled={deleteMutation.isPending}
                  onClick={() => void remove(attachment._id)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
