# TaskFlow

TaskFlow is a team task and project management app with real-time updates and an AI workspace assistant.

**Live app:** [taskflow-frontend-xuei.onrender.com](https://taskflow-frontend-xuei.onrender.com/)

## What it includes

- Accounts with email/password and Google sign-in
- Tasks, projects, teams, comments, and role-based access
- Live task updates, due-date reminders, and private file attachments
- Semantic search and **Ask workspace**, which answers questions from accessible tasks and comments with citations
- **Task assistant**, which can list tasks and propose creates or updates; changes are saved only after confirmation
- **Magic Add**, which turns meeting notes into editable task drafts
- **Daily digest** summaries for current workspace work
- A stdio Model Context Protocol (MCP) server with `list_tasks` and guarded `create_task` tools
- Retrieval evaluations, usage/cost telemetry, and CI checks

### AI tools at a glance

| Tool | Use it for | Writes data? |
| --- | --- | --- |
| Ask workspace | Ask questions about tasks and comments; inspect citations | No |
| Task assistant | Ask about tasks or request one task create/update | Only after you confirm the proposal |
| Magic Add | Turn pasted meeting notes into multiple editable task drafts | Only for drafts you choose to save |

## Tech stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- API: NestJS, TypeScript
- Data and jobs: MongoDB, Redis, BullMQ
- AI: Google Gemini through the Vercel AI SDK
- Integrations: MCP TypeScript SDK, Socket.IO, S3-compatible object storage
- Deployment: Render

## Architecture and project docs

- [AI workspace architecture and Mermaid diagram](docs/ai-workspace-architecture.md)
- [10-minute capstone demo runbook](docs/capstone-demo-runbook.md)
- [Capstone retro](docs/capstone-retro.md)
- [Backend API, AI setup, and MCP guide](backend/README.md)

## Run locally

### Requirements

- Node.js 22 and npm
- MongoDB, local or hosted
- Docker Desktop for Redis, or another Redis instance
- Google OAuth credentials for the backend's sign-in strategy

### 1. Configure and start the API

Create `backend/.env` with the required values:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/taskflow
JWT_ACCESS_SECRET=replace-with-a-random-secret-at-least-32-characters
JWT_REFRESH_SECRET=replace-with-another-random-secret-at-least-32-characters
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
```

For a local MongoDB and Redis, start Redis from the `backend` directory:

```bash
docker compose up -d redis
```

Start MongoDB separately or point `MONGODB_URI` to MongoDB Atlas. Then run the API in a terminal:

```bash
cd backend
npm ci
npm run start:dev
```

The API listens on `http://localhost:3001`; its health endpoint is `http://localhost:3001/api/health`.

### 2. Start the frontend

In another terminal, from the repository root:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local API URLs default to port 3001, so `NEXT_PUBLIC_API_URL` is not required for the standard local setup. Set it only when your API uses a different origin.

### Enable Gemini features

Add a Google AI Studio key to `backend/.env` to enable AI features:

```dotenv
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
AI_TEXT_MODEL=gemini-3.5-flash-lite
AI_EMBEDDING_MODEL=gemini-embedding-001
```

Keep this key on the backend. Never expose it through a `NEXT_PUBLIC_` variable or commit it. AI features return a service-unavailable response when no key is configured. See the [backend README](backend/README.md) for quota, cost, data handling, and feature details.

## Evaluation and checks

From the repository root:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

From `backend/`:

```bash
npm run lint
npm run build
npm test
npm run eval:workspace-retrieval
npm run mcp:smoke
```

The deterministic retrieval eval uses 20 synthetic goldens and requires at least 80% Hit@5. To measure live Gemini retrieval, configure `GOOGLE_GENERATIVE_AI_API_KEY` and run `npm run eval:workspace-retrieval:gemini`. CI runs the live eval when the same key is configured as a GitHub Actions secret. Gemini's embedding endpoint does not return token usage through the current SDK; embedding token and cost telemetry therefore uses a rough character-based estimate.

The browser end-to-end test (`npm run test:e2e` from the root) needs MongoDB and Redis available locally. CI runs frontend, backend, E2E, MCP smoke, retrieval eval, and Docker image checks.

## MCP server

The external MCP server runs over stdio. Configure the client with:

- Command: `npm run mcp` (run from `backend/`)
- `TASKFLOW_API_URL`, defaulting to `http://127.0.0.1:3001/api`
- `TASKFLOW_ACCESS_TOKEN`, a valid TaskFlow access token

The `create_task` tool requires an explicit confirmation argument. See the [MCP setup and smoke test instructions](backend/README.md#model-context-protocol-server).

## Deployment

Render configuration is in [`render.yaml`](render.yaml). Set the required MongoDB, OAuth, Gemini, and storage values in Render's service settings. The live demo link is at the top of this README.

## Security notes

- Task and comment retrieval uses the signed-in user's current access scope.
- AI-provided citations are checked against retrieved source IDs.
- Assistant writes require a one-time, short-lived user confirmation and recheck permissions before saving.
- MCP task creation rejects unconfirmed calls.
- Do not commit `.env` files, tokens, OAuth secrets, or AI API keys.
