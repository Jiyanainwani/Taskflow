import { apiRequest } from '@/lib/api-client'
import { getAccessToken } from '@/lib/auth'
import { API_URL } from '@/lib/api-url'

export type MagicTaskDraft = {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
}

export type MagicAddResult = {
  tasks: MagicTaskDraft[]
  cached: boolean
}

export type AiUsage = {
  date: string
  requestsUsed: number
  dailyLimit: number
  remaining: number
  modelCalls: number
  cacheHits: number
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  averageCostPerModelCallUsd: number
}

export type SemanticSearchResult = {
  taskId: string
  type: 'task' | 'comment'
  title: string
  snippet: string
  score: number
}

async function readAiStream(path: string, onText: (chunk: string) => void, signal?: AbortSignal) {
  const token = getAccessToken()
  if (!token) throw new Error('Please sign in to continue.')

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new Error('Unable to reach TaskFlow. Check your connection and try again.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(body.message || 'The AI response could not be started.')
  }
  if (!response.body) throw new Error('Streaming is not available in this browser.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  while (true) {
    const { value, done } = await reader.read()
    pending += decoder.decode(value, { stream: !done })
    const events = pending.split('\n\n')
    pending = events.pop() ?? ''
    for (const event of events) {
      const data = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n')
      if (!data) continue
      const payload = JSON.parse(data) as { text?: string; error?: string }
      if (payload.error) throw new Error(payload.error)
      if (payload.text) onText(payload.text)
    }
    if (done) break
  }
}

export const aiApi = {
  magicAdd(notes: string) {
    return apiRequest<MagicAddResult>('/ai/magic-add', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    })
  },

  usage() {
    return apiRequest<AiUsage>('/ai/usage')
  },

  async streamDailyDigest(
    onText: (chunk: string) => void,
    signal?: AbortSignal,
  ) {
    return readAiStream('/ai/digest', onText, signal)
  },

  streamTaskSummary(taskId: string, onText: (chunk: string) => void, signal?: AbortSignal) {
    return readAiStream(`/ai/tasks/${encodeURIComponent(taskId)}/summary`, onText, signal)
  },

  search(query: string) {
    return apiRequest<{
      results: SemanticSearchResult[]
      cached: boolean
      indexedSources: number
    }>('/ai/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
  },
}
