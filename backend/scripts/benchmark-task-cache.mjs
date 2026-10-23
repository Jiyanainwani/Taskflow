import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { Redis } from 'ioredis'

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiBaseUrl = (process.env.TASKFLOW_API_URL ?? 'http://localhost:3001/api').replace(/\/$/, '')
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const requestCount = readInteger('TASK_CACHE_BENCHMARK_REQUESTS', 100, 1, 900)
const warmRounds = readInteger('TASK_CACHE_BENCHMARK_ROUNDS', 3, 1, 20)
const concurrency = readInteger('TASK_CACHE_BENCHMARK_CONCURRENCY', 5, 1, 50)
const hitCounterKey = 'taskflow:metrics:task-list:hits'
const missCounterKey = 'taskflow:metrics:task-list:misses'
const versionKey = 'taskflow:cache:task-list:version'
const taskStatuses = ['todo', 'in-progress', 'done']
const taskPriorities = ['low', 'medium', 'high']

function readInteger(name, fallback, minimum, maximum) {
  const rawValue = process.env[name]
  if (rawValue === undefined || rawValue === '') return fallback

  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`)
  }
  return value
}

function createQueries(count) {
  const queries = []
  for (let limit = 1; limit <= 100 && queries.length < count; limit += 1) {
    for (const status of taskStatuses) {
      for (const priority of taskPriorities) {
        queries.push({ limit, status, priority })
        if (queries.length === count) return queries
      }
    }
  }
  return queries
}

function percentile95(samples) {
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * 0.95) - 1]
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with HTTP ${response.status}`)
  }
  return response.json()
}

async function login() {
  const email = process.env.TASKFLOW_EMAIL
  const password = process.env.TASKFLOW_PASSWORD
  if (!email || !password) {
    throw new Error('Set TASKFLOW_EMAIL and TASKFLOW_PASSWORD for an existing TaskFlow account')
  }

  const result = await fetchJson(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (typeof result.accessToken !== 'string') {
    throw new Error('Login response did not include an access token')
  }
  return result.accessToken
}

async function runRequests(queries, token, repetitions) {
  const work = Array.from({ length: repetitions }, () => queries).flat()
  const latencies = new Array(work.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= work.length) return

      const item = work[index]
      const query = new URLSearchParams({
        limit: String(item.limit),
        status: item.status,
        priority: item.priority,
      })
      const startedAt = performance.now()
      await fetchJson(`${apiBaseUrl}/tasks?${query}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      latencies[index] = performance.now() - startedAt
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, work.length) }, worker))
  return latencies
}

async function readCounters(redis) {
  const [hits, misses] = await redis.mget(hitCounterKey, missCounterKey)
  return { hits: Number(hits ?? 0), misses: Number(misses ?? 0) }
}

async function waitForCounters(redis, expectedReads) {
  const deadline = Date.now() + 5000
  let counters = await readCounters(redis)
  while (counters.hits + counters.misses < expectedReads && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    counters = await readCounters(redis)
  }
  if (counters.hits + counters.misses < expectedReads) {
    throw new Error(
      `Redis recorded ${counters.hits + counters.misses} of ${expectedReads} expected task-list reads`,
    )
  }
  return counters
}

function formatMilliseconds(value) {
  return `${value.toFixed(2)} ms`
}

async function main() {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 5000 })
  try {
    await redis.ping()
    const token = await login()
    const queries = createQueries(requestCount)

    // These counters are shared by the API, so the report documents the reset and
    // the README asks users not to run another load test at the same time.
    await redis.del(hitCounterKey, missCounterKey)
    await redis.incr(versionKey)

    const coldLatencies = await runRequests(queries, token, 1)
    const coldCounters = await waitForCounters(redis, requestCount)
    const warmLatencies = await runRequests(queries, token, warmRounds)
    const allCounters = await waitForCounters(redis, requestCount * (warmRounds + 1))
    const warmCounters = {
      hits: allCounters.hits - coldCounters.hits,
      misses: allCounters.misses - coldCounters.misses,
    }
    const totalReads = allCounters.hits + allCounters.misses
    const hitRate = totalReads === 0 ? 0 : (allCounters.hits / totalReads) * 100
    const coldP95 = percentile95(coldLatencies)
    const warmP95 = percentile95(warmLatencies)
    const latencyReduction = coldP95 === 0 ? 0 : ((coldP95 - warmP95) / coldP95) * 100
    const timestamp = new Date().toISOString()
    const report = `# Task-list cache benchmark\n\n` +
      `- Run at: ${timestamp}\n` +
      `- API: ${apiBaseUrl}\n` +
      `- Query count per pass: ${requestCount}\n` +
      `- Warm rounds: ${warmRounds}\n` +
      `- Concurrency: ${concurrency}\n` +
      `- Cold-cache p95: ${formatMilliseconds(coldP95)}\n` +
      `- Warm-cache p95: ${formatMilliseconds(warmP95)}\n` +
      `- p95 latency reduction: ${latencyReduction.toFixed(2)}%\n` +
      `- Cache hits: ${allCounters.hits}\n` +
      `- Cache misses: ${allCounters.misses}\n` +
      `- Cold-pass hits/misses: ${coldCounters.hits}/${coldCounters.misses}\n` +
      `- Warm-pass hits/misses: ${warmCounters.hits}/${warmCounters.misses}\n` +
      `- Overall cache hit rate: ${hitRate.toFixed(2)}%\n\n` +
      `The script logged in once and made read-only task-list requests. Cold results use a new cache generation; warm results repeat the same query URLs. Results depend on the local API, Redis, MongoDB, dataset, and machine load.\n`

    const reportDirectory = path.join(backendDirectory, 'reports')
    await mkdir(reportDirectory, { recursive: true })
    const reportPath = path.join(reportDirectory, 'task-cache-performance.md')
    await writeFile(reportPath, report, 'utf8')
    console.log(`Benchmark complete. Report written to ${reportPath}`)
    console.log(`Cold p95: ${formatMilliseconds(coldP95)}; warm p95: ${formatMilliseconds(warmP95)}; hit rate: ${hitRate.toFixed(2)}%`)
  } finally {
    await redis.quit()
  }
}

main().catch((error) => {
  console.error(`Task-cache benchmark failed: ${error.message}`)
  process.exitCode = 1
})
