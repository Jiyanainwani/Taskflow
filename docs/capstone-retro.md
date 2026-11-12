# AI workspace capstone retro

Draft based on the implementation and CI artifacts; replace or add team observations after the final demo.

## What went well

- The read-only RAG path uses the same access-filtered task query as the product and validates citations against retrieved sources.
- Task writes are split into proposal and confirmation requests. Approval IDs are user-scoped, expire after ten minutes, and are consumed once.
- The external MCP server calls the existing TaskFlow API, so access checks remain in the application boundary.
- CI exercises the retrieval reranker against a 20-question golden set, checks MCP tool discovery plus the write-confirmation guard, and runs Gemini-backed retrieval scoring when its API key secret is configured.
- Request logs capture token usage, estimated cost, retrieval counts, and duration without logging task text.

## Trade-offs

- The 100-task/100-comment source cap keeps embedding cost bounded but can miss older evidence.
- The hybrid reranker is inexpensive, but exact lexical matching may under-rank paraphrases. CI's offline check uses fixed vector scores; the optional Gemini-backed check exercises semantic embeddings against synthetic goldens and reports cost and latency.
- The stdio MCP server uses a configured bearer access token. This is suitable for a local demo; a hosted MCP server should use short-lived delegated authorization.
- The agent supports one create or update proposal per request. Multi-action plans need a review screen that can approve or reject each operation independently.

## What to improve next

- Collect a permission-safe set of real questions and expected sources, then extend live evaluation to citation precision, latency, and cost over representative workspace content.
- Add retrieval feedback so the team can review misses and tune chunk size, overlap, and reranking weights from evidence.
- Consider token refresh for MCP clients so access does not depend on manually updating a short-lived token.
- Add browser-level approval tests for create, update, reject, expiry, and repeated confirmation.

## Demo and discussion prompts

1. Ask a question whose answer spans a task and a comment, then open both citations.
2. Ask the assistant to create a task, edit the proposal, reject it, and show that no task was written.
3. Repeat and confirm; show the resulting task and its normal activity/permission behavior.
4. Connect an external MCP client, list accessible tasks, call `create_task` without confirmation, then explain the explicit confirmation argument.
5. Review the 20-query CI eval and discuss why it protects reranking logic but cannot prove live embedding quality.
