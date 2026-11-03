import { getAccessToken } from '@/lib/auth'
import { API_URL } from '@/lib/api-url'

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken()

  if (!token) {
    throw new Error('Please sign in to continue.')
  }

  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    })
  } catch {
    throw new Error('Unable to reach TaskFlow. Check your connection and try again.')
  }

  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[]
  } & T

  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(' ') : body.message
    throw new Error(message || 'Something went wrong. Please try again.')
  }

  return body
}
