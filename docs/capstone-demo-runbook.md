# TaskFlow AI workspace capstone demo

**Length:** 10 minutes  
**Audience:** TaskFlow team  
**Goal:** Show grounded answers, approval-gated task changes, an external MCP client, and the quality checks that guard the system.

## Before the demo

- Start MongoDB, Redis, the backend, and the frontend. Sign in with a user who can see the demo workspace.
- Configure `GOOGLE_GENERATIVE_AI_API_KEY` on the backend. Do not put it in a `NEXT_PUBLIC_` variable or commit it.
- Prepare one task with useful description text and one comment containing a second detail that is not in the task description.
- Have one task available for an assistant update proposal and a spare task title for a create proposal.
- Start an MCP client configured with `backend/src/mcp/taskflow-mcp-server.ts`, `TASKFLOW_API_URL`, and a valid `TASKFLOW_ACCESS_TOKEN`.
- Run `npm run eval:workspace-retrieval --prefix backend`. If the Gemini key is available locally, also run `npm run eval:workspace-retrieval:gemini --prefix backend`.
- Keep the architecture diagram and this runbook open for the discussion.

## Ten-minute talk track

| Time | Segment | Presenter actions and points |
| --- | --- | --- |
| 0:00–0:45 | Problem and scope | Explain that TaskFlow answers questions from accessible tasks/comments, proposes task actions for review, and exposes a small MCP surface. State that assistant writes require confirmation. |
| 0:45–2:00 | Architecture | Walk through access-filtered records, 900-character chunks with 120-character overlap, Gemini embeddings, cosine retrieval, 75/25 vector/lexical reranking, schema-checked citations, Redis approval tokens, and the MCP stdio server. |
| 2:00–4:00 | Ask workspace | Ask a question whose answer uses the prepared task and comment. Open both citations and point out that each link returns to the source item. Ask something absent from the workspace and show the no-evidence response. |
| 4:00–6:15 | Task assistant | Ask it to create a task. Review the proposal, reject it, and show that no task was created. Ask again, confirm, and show the new task. If time allows, repeat with an update proposal. |
| 6:15–7:30 | MCP client | In the external MCP client, list available tools and call `list_tasks`. Call `create_task` without `confirm: true` and show the refusal. Explain that the TaskFlow UI confirmation path is used for writes from the workspace assistant. |
| 7:30–8:45 | Evals and observability | Show the 20-question golden set and deterministic 80% Hit@5 CI gate. If configured, show the Gemini-backed Hit@5, token count, estimated cost, model, and latency. Mention that goldens are synthetic and contain no private workspace data. |
| 8:45–10:00 | Trade-offs and next steps | Discuss the 100-task/100-comment source cap, lexical reranking limits, and static-token setup for the local MCP demo. Propose a permission-safe real evaluation corpus and delegated OAuth for hosted MCP as next steps. Take questions. |

## Demo recovery notes

- **No answer or provider error:** verify the backend AI key and inspect backend logs; use the prepared question only after confirming its sources are indexed.
- **Citation opens an unavailable item:** verify that the signed-in demo user still has task/team access, then use another prepared source.
- **Assistant proposal is missing:** check Redis and retry once. Do not claim a write succeeded until the task list shows it.
- **MCP token expired:** obtain a fresh access token and update the MCP client's environment before reconnecting.
- **Gemini eval key unavailable:** show the deterministic CI gate and identify the live eval as a configured-secret check; do not present the fixed-vector score as Gemini retrieval quality.

## Architecture and retro

See [the architecture document](ai-workspace-architecture.md) for request/data flows and design trade-offs, and [the capstone retro](capstone-retro.md) for implementation observations and follow-up work.
