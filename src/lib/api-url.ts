function normalizeApiUrl(url: string) {
  const normalizedUrl = url.replace(/\/+$/, '')
  return normalizedUrl.endsWith('/api') ? normalizedUrl : `${normalizedUrl}/api`
}

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL

// Keep the local task API on IPv4, which is where the Nest dev server listens.
export const API_URL = normalizeApiUrl(
  configuredApiUrl ?? 'http://127.0.0.1:3001/api',
)

// Auth previously used localhost; preserving it keeps the refresh cookie on
// the same host as the browser's localhost frontend.
export const AUTH_API_URL = normalizeApiUrl(
  configuredApiUrl ?? 'http://localhost:3001/api',
)

export const API_ORIGIN = new URL(API_URL).origin
