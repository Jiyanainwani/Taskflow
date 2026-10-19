const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api').replace(/\/$/, '')
const ACCESS_TOKEN_KEY = 'taskflow.accessToken'

type AuthResponse = {
  accessToken?: string
  message?: string
  user?: { id: string; name: string; email: string }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    throw new Error('Unable to reach TaskFlow. Check your connection and try again.')
  }

  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[]
  } & T

  if (!response.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join(' ')
      : body.message
    throw new Error(message || 'Something went wrong. Please try again.')
  }

  return body
}

export function saveAccessToken(token: string) {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function getAccessToken() {
  return typeof window === 'undefined'
    ? null
    : sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export async function login(email: string, password: string) {
  const result = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!result.accessToken) throw new Error('The server did not return an access token.')
  saveAccessToken(result.accessToken)
  return result
}

export async function signup(name: string, email: string, password: string) {
  return request<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
}

let refreshInFlight: Promise<string> | null = null

export async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = request<AuthResponse>('/auth/refresh', { method: 'POST' })
      .then((result) => {
        if (!result.accessToken) {
          throw new Error('The server did not return an access token.')
        }
        saveAccessToken(result.accessToken)
        return result.accessToken
      })
      .finally(() => {
        refreshInFlight = null
      })
  }

  return refreshInFlight
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' })
  } finally {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  }
}

export function clearAccessToken() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
}
