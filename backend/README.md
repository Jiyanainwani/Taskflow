<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Task-list Redis cache

The task list uses a 30-second Redis cache with separate entries per user and query. Task writes and team membership changes advance a shared cache generation so stale pages are no longer served. Cache reads fall back to MongoDB when Redis is unavailable.

## Due-date reminders

Task reminders are persisted in BullMQ on Redis and sent to the task owner's email when the selected due date and time arrives. Changing a due date reschedules the job; completing or deleting a task cancels its pending reminder. Delivery failures retry three times with exponential backoff, then appear at `/dashboard/admin/reminders` for an administrator to review or retry.

Add these settings to `backend/.env` to enable SMTP delivery and the restricted failed-reminder view:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=taskflow@example.com
TASKFLOW_ADMIN_USER_IDS=your-mongodb-user-id
```

`TASKFLOW_ADMIN_USER_IDS` accepts comma-separated MongoDB user IDs. The API denies access to the failed-reminder endpoints when the requester is not on this allowlist. Without SMTP settings, the reminder job retries and then enters the dead-letter queue; the rest of the API can still start.

### Task attachments

Task attachments use private S3-compatible object storage with presigned uploads and downloads. Set `S3_BUCKET` and `S3_REGION`; for AWS, credentials can use the normal AWS SDK credential chain, or set `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`. For an S3-compatible provider, also set `S3_ENDPOINT` and the provider credentials. Keep the bucket private.

Uploads are limited to PDF, JPEG, PNG, and WebP files up to 10 MB. The API checks the declared type, stored size, and file signature before listing an upload. Task readers can download files; only users allowed to edit a task can upload or delete them. The API can start without storage configured, but attachment operations return `503 Service Unavailable` until `S3_BUCKET` is set.

Configure bucket CORS for the frontend origin with `PUT` and `GET` methods and the `Content-Type` request header. The browser uploads directly to the short-lived signed URL, so object bytes do not pass through the API server.

```dotenv
S3_BUCKET=your-private-bucket
S3_REGION=us-east-1
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

Start the API and Redis together with Docker Compose from this directory:

```bash
docker compose up --build
```

The API connects to the Compose Redis service automatically. When running the API directly with `npm run start:dev`, it uses `REDIS_URL` or defaults to `redis://localhost:6379`.

Redis tracks task-list reads in `taskflow:metrics:task-list:hits` and `taskflow:metrics:task-list:misses`; use these counters to calculate the cache hit rate during the Week 3 load test.

### Run the task-cache benchmark

With the API and Redis running, run this from the `backend` directory. Use an existing TaskFlow account:

```powershell
$env:TASKFLOW_EMAIL="you@example.com"
$env:TASKFLOW_PASSWORD="your-password"
npm run benchmark:tasks
```

The script defaults to `http://localhost:3001/api` and `redis://localhost:6379`. Override these with `TASKFLOW_API_URL` and `REDIS_URL` when needed. `TASK_CACHE_BENCHMARK_REQUESTS` sets the number of unique task-list queries (1–900, default 100), `TASK_CACHE_BENCHMARK_ROUNDS` sets warm-cache rounds (default 3), and `TASK_CACHE_BENCHMARK_CONCURRENCY` sets simultaneous requests (default 5).

The benchmark logs in once and performs only `GET /tasks` requests. It clears the two Redis read-metric counters and increments the shared task-cache generation to ensure the cold pass starts without reusable entries; this does not delete tasks or MongoDB data. Avoid running other load tests at the same time, since they would affect the shared counters. The script writes measured p95 latency and hit-rate results to `reports/task-cache-performance.md`; no figures are committed before a real run.

Email/password login is limited to 10 attempts per client IP in a rolling 15-minute window. A blocked request receives `429 Too Many Requests` and a `Retry-After` header. IP addresses are hashed before they are used as Redis keys. If Redis is unavailable, login remains available and the limiter logs a warning. If the API is deployed behind a trusted reverse proxy, configure Express proxy trust for that deployment so the limiter receives the actual client IP.

## Week 5 AI features

The AI API uses Vercel AI SDK with Google's Gemini API. Set the key on the backend only; it is separate from `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` used for sign-in. The API can still start without the AI key, but AI requests return a friendly `503` until it is configured.

```dotenv
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-studio-key
AI_TEXT_MODEL=gemini-3.8-flash
AI_EMBEDDING_MODEL=gemini-embedding-001
AI_DAILY_REQUEST_LIMIT=10
AI_INPUT_USD_PER_MILLION=0.75
AI_OUTPUT_USD_PER_MILLION=3.75
```

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey). Never put it in a `NEXT_PUBLIC_` variable or frontend code. The default daily request limit is 10 per user and can be changed by the backend operator. Redis is required to enforce the limit and serve prompt-cache entries; AI requests fail safely if Redis is unavailable.

`POST /api/ai/magic-add` accepts up to 12,000 characters of meeting notes and returns Zod-validated task drafts. It does not save tasks; the user must review and confirm them through the existing task creation API. A schema-invalid model response is retried once, then returned as a friendly error. Identical normalized prompts are cached per user for 24 hours. Each accepted request, including a cache hit, consumes one daily request. Usage is available at `GET /api/ai/usage`, including input/output tokens, model-call count, cache hits, estimated cost, and average estimated cost per model call.

The estimated cost uses configurable input/output rates (defaulting to the current Gemini 3.8 Flash paid list rates); it is a list-price estimate, not a billing record. Eligible free-tier requests may cost $0 while within Google’s free limits. Model pricing and free-tier availability can change; check [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) before reporting a final average. Google’s free tier may use submitted content to improve its products. Use synthetic meeting notes for free-tier testing and do not send confidential work notes unless your provider plan and organization policy allow it.

The prompt treats meeting notes as untrusted data, the model has no tools, and task drafts are constrained to a Zod schema. This prevents the generation request from saving or changing tasks. Input length, empty/emoji-only content, authentication, daily quota, and output shape are checked server-side.

## Health, logs, and error tracking

`GET /api/health` checks MongoDB and Redis and responds with `503 Service Unavailable` if either dependency is unhealthy. The API writes structured JSON logs through Pino and redacts authorization and cookie headers.

Set `SENTRY_DSN` to enable Sentry reporting. `SENTRY_ENVIRONMENT` labels events and `SENTRY_TRACES_SAMPLE_RATE` controls trace sampling (default `0`). To deliberately verify event delivery, set `SENTRY_TEST_ENABLED=true`, sign in as an administrator listed in `TASKFLOW_ADMIN_USER_IDS`, then request `GET /api/admin/observability/sentry-test`; it deliberately returns an error that should appear in Sentry. Turn the test endpoint off again with `SENTRY_TEST_ENABLED=false` after verification.

## CI and browser acceptance test

GitHub Actions runs frontend lint/typecheck/build, backend lint/build/unit/e2e checks, a Playwright flow that signs up, signs in, creates a task, and confirms it appears in a second tab, plus a Docker image build. Locally, `npm run test:e2e` requires MongoDB and Redis on localhost and starts both the API and frontend for the browser test.

## Deploy on Render

The repository-root `render.yaml` defines the frontend, Dockerized API, and private Redis-compatible Key Value service in Singapore. After this file is merged to `main`, create a Render Blueprint from the repository and use the free plans for a demo. Render deploys new commits after the GitHub checks pass. The blueprint generates JWT secrets and asks for MongoDB Atlas, Google OAuth, admin user IDs, and S3-compatible storage settings. It derives the frontend/API URLs from Render's service URLs; add the resulting API callback URL (`https://<api-service>.onrender.com/api/auth/google/callback`) to the Google OAuth client's authorized redirect URIs.

Render's free services are for testing and demos, not production: web services sleep when idle, free Key Value data is lost when it restarts, and free web services cannot send outbound SMTP on ports 465 or 587. Due-date reminder email will not work through Gmail SMTP on the free plan. For production, use paid services with persistent Key Value storage and an email provider/plan that permits delivery. Do not put local `.env` secrets in `render.yaml` or Git.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/overview) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
