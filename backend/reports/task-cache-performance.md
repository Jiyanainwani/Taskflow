# Task-list cache benchmark

- Run at: 2026-10-19T10:01:03.822Z
- API: http://127.0.0.1:3001/api
- Query count per pass: 100
- Warm rounds: 3
- Concurrency: 5
- Cold-cache p95: 80.58 ms
- Warm-cache p95: 13.32 ms
- p95 latency reduction: 83.47%
- Cache hits: 300
- Cache misses: 100
- Cold-pass hits/misses: 0/100
- Warm-pass hits/misses: 300/0
- Overall cache hit rate: 75.00%

The script logged in once and made read-only task-list requests. Cold results use a new cache generation; warm results repeat the same query URLs. Results depend on the local API, Redis, MongoDB, dataset, and machine load.
