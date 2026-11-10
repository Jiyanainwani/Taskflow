import { apiRequest } from '@/lib/api-client'

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
}
