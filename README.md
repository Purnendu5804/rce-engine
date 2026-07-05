# RCE Engine

A Remote Code Execution engine, built from scratch as a learning project — architecturally inspired by [Judge0](https://judge0.com/). It accepts source code submissions over HTTP, executes them inside isolated, resource-limited Docker containers, and persists results for later retrieval.

Originally built as a general-purpose code runner, now evolving toward powering a DSA (Data Structures & Algorithms) battle platform.

## What it does

1. A client submits code + language via `POST /submit`.
2. The submission is persisted to Postgres with status `queued`, and pushed onto a Redis-backed job queue.
3. A worker process picks up the job, spins up a locked-down Docker container, runs the code inside it, and captures stdout/stderr/exit code.
4. The result is written back to Postgres against the same submission `id`.
5. The client polls `GET /submit/:id` to retrieve the current status and result.

Execution is sandboxed and defensive by design:
- No network access from inside the container (`NetworkMode: none`)
- Memory limits per container
- Process count limits (`PidsLimit`) to prevent fork bombs
- A hard execution timeout, after which the container is forcibly killed
- Each submission runs in its own throwaway container and temp directory, cleaned up after every run

## Architecture

```
                    ┌──────────────┐
   POST /submit     │              │
 ─────────────────► │   Express    │
                    │   API        │
                    │              │
                    └──────┬───────┘
                           │
              ┌────────────┴─────────────┐
              │                          │
              ▼                          ▼
     ┌─────────────────┐         ┌────────────────┐
     │   PostgreSQL    │         │  Redis (BullMQ)│
     │  (Submission    │◄───┐    │   job queue    │
     │   row: queued)  │    │    └───────┬────────┘
     └─────────────────┘    │            │
              ▲             │            ▼
              │             │    ┌────────────────┐
              │             └────┤     Worker     │
              │                  │  (BullMQ       │
              │                  │   consumer)    │
              │                  └───────┬────────┘
              │                          │
              │  update: stdout,         ▼
              │  stderr, exitCode,  ┌────────────────┐
              └──────────────status─┤   Executor     │
                                    │  (dockerode)   │
                                    └───────┬────────┘
                                             │
                                             ▼
                                    ┌────────────────┐
                                    │ Docker         │
                                    │ container      │
                                    │ (per-language  │
                                    │  runtime image,│
                                    │  sandboxed)    │
                                    └────────────────┘

   GET /submit/:id
 ─────────────────► Express API ──► PostgreSQL (read current status/result)
```

### Flow summary

| Step | Component | Responsibility |
|---|---|---|
| 1 | Express API (`POST /submit`) | Validates request, generates a submission `id`, inserts a `queued` row into Postgres, enqueues a job in BullMQ |
| 2 | BullMQ / Redis | Holds the job until a worker is free to process it |
| 3 | Worker | Pulls the job, calls the language-specific executor |
| 4 | Executor (dockerode) | Creates a sandboxed container, runs the code, captures output, enforces timeout, cleans up |
| 5 | Worker | Writes the execution result back to the same Postgres row (`id` matches across API, queue, and DB) |
| 6 | Express API (`GET /submit/:id`) | Reads the current row from Postgres and returns it to the client |

The `id` generated at submission time is the thread that ties everything together — it's the same value used as the BullMQ job identifier and the Postgres primary key, so any component can look up a submission's current state using just that one id.

## Tech stack

- **Runtime**: Node.js, TypeScript (strict mode)
- **API**: Express
- **Queue**: BullMQ + Redis
- **Sandboxing**: Docker + dockerode
- **Database**: PostgreSQL via Prisma ORM (with `@prisma/adapter-pg`)
- **Containerization (infra)**: Docker Compose (Redis + Postgres services)

## Project structure

```
rce-engine/
├── docker-compose.yml         # Redis + Postgres services
├── prisma/
│   └── schema.prisma          # Submission model
├── src/
│   ├── api/
│   │   └── submit.ts          # POST /submit, GET /submit/:id
│   ├── config/
│   │   ├── env.ts             # centralized env var loading
│   │   └── redis.ts           # Redis connection config
│   ├── executor/
│   │   └── pythonExecutor.ts  # runPython — Docker-based execution + timeout
│   ├── generated/
│   │   └── prisma/            # generated Prisma client (not committed)
│   ├── lib/
│   │   └── prisma.ts          # shared PrismaClient singleton
│   ├── queue/
│   │   ├── submissionQueue.ts # BullMQ queue definition
│   │   └── submissionWorker.ts# BullMQ worker — runs executor, persists result
│   └── types/
│       └── submission.ts      # SubmissionRequest / SubmissionResponse types
└── .env                        # DATABASE_URL, PORT, REDIS_HOST, REDIS_PORT
```

## API

### `POST /submit`

Request body:
```json
{
  "language": "python",
  "code": "print(\"hello world\")",
  "stdin": ""
}
```

Response (`202 Accepted`):
```json
{
  "id": "0cada6d7-d8bc-4955-82b4-a7e50b42b74d",
  "status": "queued"
}
```

### `GET /submit/:id`

Response (`200 OK`):
```json
{
  "id": "0cada6d7-d8bc-4955-82b4-a7e50b42b74d",
  "language": "python",
  "code": "print(\"hello world\")",
  "stdin": "",
  "stdout": "hello world\n",
  "stderr": "",
  "exitCode": 0,
  "status": "completed",
  "createdAt": "2026-07-05T12:46:23.584Z"
}
```

Returns `404` if no submission exists with that `id`.

## Local setup

### Prerequisites

- Node.js (v18+ recommended)
- Docker & Docker Compose
- npm

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd rce-engine
npm install
```

### 2. Start Redis and Postgres

```bash
docker-compose up -d
```

This starts:
- `rce-redis` on port `6379`
- `rce-postgres` on port `5432` (user/password/db as configured in `docker-compose.yml`)

### 3. Configure environment variables

Create a `.env` file in the project root:

```
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
DATABASE_URL="postgresql://rce_user:rce_password@localhost:5432/rce_db"
```

### 4. Run database migrations

```bash
npx prisma migrate dev
```

This creates the `Submission` table in Postgres and generates the Prisma Client.

### 5. Build the language runtime image(s)

The executor runs submitted code inside a purpose-built Docker image (non-root user, no unnecessary tooling). For Python:

```bash
docker build -t rce-python:latest -f docker/runtimes/python/Dockerfile .
```



### 6. Start the API server

```bash
npm run dev
```


### 7. Try it

```bash
curl -X POST http://localhost:3000/submit \
  -H "Content-Type: application/json" \
  -d '{"language": "python", "code": "print(\"hello world\")", "stdin": ""}'
```

Then poll for the result using the returned `id`:

```bash
curl http://localhost:3000/submit/<id>
```

## Roadmap

- [x] Python execution with sandboxing (memory, network, process limits)
- [x] Execution timeout handling
- [x] Persistent storage via PostgreSQL + Prisma
- [x] Submission polling endpoint
- [ ] C++ support
- [ ] Java support
- [ ] `status` as a proper enum (`queued | processing | completed | failed | timeout`)
- [ ] Multiple test case execution (for DSA-judge use case)
- [ ] Deployment

## Notes on design decisions

- **Same `id` across API, queue, and database** — deliberately, so any component can resolve a submission's current state without cross-referencing multiple identifiers.
- **Database row inserted before the job is queued**, not after — ensures a row always exists by the time execution could possibly complete, avoiding upsert logic.
- **Driver adapter (`@prisma/adapter-pg`) instead of Prisma Accelerate** — this project runs as a small number of long-lived local processes, not a serverless fleet, so a direct Postgres connection is simpler and keeps everything running locally without an external proxy dependency.
- **Local Postgres and Redis via Docker Compose, not a managed cloud service** — keeps the whole stack self-contained, inspectable, and consistent with the project's "understand every layer" learning goal.