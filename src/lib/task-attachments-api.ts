import { apiRequest } from '@/lib/api-client'

export type TaskAttachment = {
  _id: string
  filename: string
  contentType: string
  size: number
  uploadedBy: { _id: string; name?: string; email?: string } | string
  createdAt: string
}

type UploadTicket = { attachmentId: string; uploadUrl: string }

const allowedTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const maxSize = 10 * 1024 * 1024

export const taskAttachmentsApi = {
  list(taskId: string) {
    return apiRequest<TaskAttachment[]>(`/tasks/${encodeURIComponent(taskId)}/attachments`)
  },

  async upload(taskId: string, file: File) {
    if (!allowedTypes.has(file.type)) {
      throw new Error('Choose a PDF, JPEG, PNG, or WebP file.')
    }
    if (file.size < 1 || file.size > maxSize) {
      throw new Error('Files must be smaller than 10 MB.')
    }

    const prefix = `/tasks/${encodeURIComponent(taskId)}/attachments`
    const ticket = await apiRequest<UploadTicket>(`${prefix}/upload`, {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
    })

    try {
      const uploaded = await fetch(ticket.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploaded.ok) throw new Error('File upload failed. Please try again.')

      return await apiRequest<TaskAttachment>(`${prefix}/${ticket.attachmentId}/complete`, {
        method: 'POST',
      })
    } catch (error) {
      await apiRequest(`${prefix}/${ticket.attachmentId}`, { method: 'DELETE' }).catch(() => undefined)
      if (error instanceof TypeError) {
        throw new Error('Could not reach file storage. Check the bucket CORS settings and try again.')
      }
      throw error
    }
  },

  async download(taskId: string, attachment: TaskAttachment) {
    const prefix = `/tasks/${encodeURIComponent(taskId)}/attachments`
    const { url } = await apiRequest<{ url: string }>(
      `${prefix}/${encodeURIComponent(attachment._id)}/download`,
    )
    const response = await fetch(url)
    if (!response.ok) throw new Error('Could not download this attachment.')

    const objectUrl = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = attachment.filename
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  },

  remove(taskId: string, attachmentId: string) {
    return apiRequest<{ message: string }>(
      `/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { method: 'DELETE' },
    )
  },
}
