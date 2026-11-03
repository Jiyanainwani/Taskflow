import { apiRequest } from '@/lib/api-client'

export const reminderAdminAccessQueryKey = (userId: string | null) =>
  ['admin', 'reminders', 'access', userId] as const

export type ReminderAdminAccess = { isAdmin: true }

export function checkReminderAdminAccess() {
  return apiRequest<ReminderAdminAccess>('/admin/reminders/access')
}
