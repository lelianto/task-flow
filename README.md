# TaskFlow

> Make every transition understandable, every decision intentional, and every change traceable.

TaskFlow is an explainable internal task-management workspace built with React, Express, TypeScript, Prisma, and SQLite. It combines a responsive Kanban board, a strict ordered workflow, operational task metadata, append-only activity history, and optional DeepSeek-powered audit explanations.

The project was created for a full-stack take-home assignment. Its goal is not feature volume. Its goal is to demonstrate clear domain modeling, end-to-end consistency, transactional integrity, deliberate trade-offs, and code that can be explained confidently in a technical interview.

## Table of contents

- [Product principles](#product-principles)
- [Features](#features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Available commands](#available-commands)
- [Workflow rules](#workflow-rules)
- [Data model and integrity](#data-model-and-integrity)
- [API reference](#api-reference)
- [AI Insights](#ai-insights)
- [Testing strategy](#testing-strategy)
- [Design decisions and trade-offs](#design-decisions-and-trade-offs)
- [Take-home discussion answers](#take-home-discussion-answers)
- [Limitations and production roadmap](#limitations-and-production-roadmap)
- [AI usage disclosure](#ai-usage-disclosure)

## Product principles

TaskFlow treats **cognitive clarity** as a functional requirement. A user should be able to answer three questions without trial and error:

1. **What is happening?** The current task state and operational context are immediately visible.
2. **What can I do next?** Permitted transitions and blocked-transition reasons are explained before or during an action.
3. **What happened before?** Verified activity shows who changed what, from which value to which value, and when.

AI is deliberately subordinate to these principles. It explains verified events on request, but it never decides workflow rules, mutates data, or replaces the original timeline.

## Features

### Task management

- Create a task with a title, optional description, assignee, priority, due date, and source.
- List active tasks on a Kanban board or in a table view.
- Search tasks client-side.
- Move tasks through `To Do → Pending → In Progress → Done`.
- Change status through drag-and-drop or an accessible status selector.
- Soft-delete tasks and inspect their retained history from a read-only Deleted view.
- Mark tasks that require human attention and resolve the escalation explicitly.

### Explainable workflow

- Valid and blocked Kanban destinations are visually distinguished during dragging.
- Invalid transitions are rejected by the backend even if frontend checks are bypassed.
- Error messages explain the applicable rule, such as disabled backward transitions or disabled skipping.
- Task details show available next states and explain why other destinations are unavailable.
- The workflow is fixed to one-step-forward transitions so neither the UI nor API can relax the assignment's domain rule.

### Immutable history

- Every real status change creates exactly one audit event.
- Same-status requests are idempotent: they do not update the task timestamp and do not create audit events.
- Activity events are displayed chronologically with deterministic tie-breaking.
- Actor, previous status, new status, and timestamp remain independently visible without AI.
- Database triggers reject updates and deletes against append-only history tables.

### Operational visibility

- Dashboard metrics summarize active work, overdue items, status distribution, and human-attention queues.
- Generalized activity captures creation, operational updates, status changes, escalation, resolution, and deletion.
- Activity can be filtered by task, actor, source, status, and date range.

### Optional AI Insights

- Users explicitly request an AI explanation from the task detail panel.
- Deterministic backend analysis calculates counts, actors, current status, and event boundaries.
- DeepSeek only turns verified facts into concise natural language.
- AI content is clearly labeled and never replaces the verified activity timeline.
- Provider errors remain isolated: task management and audit history continue to work normally.

## Technology stack

| Concern | Choice | Reason |
| --- | --- | --- |
| Workspace | pnpm monorepo | Small, explicit boundary between web, API, and shared domain code |
| Frontend | React 19, TypeScript, Vite | Fast local development without unnecessary SSR complexity |
| Server state | TanStack Query | Query caching, invalidation, and mutation lifecycle management |
| Drag-and-drop | dnd-kit | Pointer and keyboard-capable interaction model |
| Icons | Lucide React | Consistent, lightweight iconography |
| Backend | Node.js, Express 5, TypeScript | Direct and reviewable HTTP layer |
| Validation | Zod | Runtime request validation with typed schemas |
| Persistence | SQLite and Prisma | Real transactions with a zero-service local setup |
| AI provider | DeepSeek Chat Completions API | Optional contextual audit explanation |
| Testing | Vitest, Supertest, React Testing Library | Domain, API integration, and UI interaction coverage |
| Quality | ESLint and strict TypeScript | Consistent static checks across the workspace |

## Architecture

```text
Browser
  │ React + TanStack Query
  ▼
Express routes
  ├── Zod request validation
  ├── Task domain service
  │     ├── workflow policy
  │     ├── conditional status update
  │     └── audit/activity append
  ├── deterministic insight analysis
  │     └── optional DeepSeek explanation
  ▼
Prisma transaction boundary
  ▼
SQLite
  ├── Task
  ├── AuditLog
  ├── ActivityEvent
  ├── WorkflowSettings
  └── immutability triggers
```

### Repository structure

```text
task-flow/
├── apps/
│   ├── api/
│   │   ├── prisma/              # schema and versioned migrations
│   │   ├── src/
│   │   │   ├── db/              # local database preparation
│   │   │   ├── lib/             # Prisma client and application errors
│   │   │   └── modules/         # tasks and AI insights
│   │   └── tests/               # API integration tests
│   └── web/
│       └── src/
│           ├── app/              # application shell and query client
│           ├── components/       # reusable interaction components
│           ├── features/         # tasks and operational insights
│           └── lib/              # typed API client
├── packages/
│   └── shared/                   # framework-free types and workflow policy
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

The backend is the source of truth. Frontend checks improve usability, but every transition and actor is validated again by the API.

Status updates use an optimistic UI with rollback. A card moves immediately, then returns to its previous column if the backend rejects the transition. The backend remains authoritative and commits the status plus audit record atomically.

## Getting started

### Prerequisites

- Node.js 22 or newer
- pnpm 10 or newer

```bash
node --version
pnpm --version
```

### Installation

```bash
pnpm install
pnpm db:setup
pnpm dev
```

Open:

- Web application: `http://localhost:300`
- API: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`

`pnpm db:setup` generates the Prisma client, creates the SQLite file when necessary, applies all migrations, and enables the local SQLite settings.

## Configuration

Local API configuration lives in `apps/api/.env`. This file is ignored by Git. Use `apps/api/.env.example` as the safe template:

```dotenv
DATABASE_URL="file:./taskflow.db"
PORT=3001

# Optional: core functionality works without AI.
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
```

Never place the DeepSeek key in a Vite variable, browser bundle, committed file, screenshot, or client response. Restart the API after changing environment variables.

Without `DEEPSEEK_API_KEY`, the endpoint still returns deterministic audit facts and the UI explains that AI generation is unavailable. All core task, workflow, and history features remain operational.

## Deployment

The repository-level `vercel.json` builds the web workspace and serves its Vite SPA routes correctly. Import the repository into Vercel with the repository root as the project root, then set:

```dotenv
VITE_API_BASE_URL=https://your-taskflow-api.example.com
```

The value is embedded into the browser build, must not contain secrets, and should not end with `/`. The API must allow requests from the Vercel domain; the current Express configuration enables CORS.

Deploy the API to a long-running Node.js host with persistent storage. The included SQLite database is intended for a persistent filesystem and must not be deployed as ephemeral Vercel Functions storage. For a fully serverless deployment, migrate Prisma to a hosted database before moving the API to Vercel.

## Available commands

Run commands from the repository root:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the API and Vite development servers together |
| `pnpm db:setup` | Generate Prisma, apply migrations, and prepare SQLite |
| `pnpm test` | Run all domain, API, and UI tests |
| `pnpm lint` | Run ESLint in every workspace package |
| `pnpm typecheck` | Run strict TypeScript checks |
| `pnpm build` | Build the shared package, API, and web application |
| `pnpm verify` | Run lint, typecheck, tests, and production builds |

Before submission, run:

```bash
pnpm verify
```

## Workflow rules

The ordered statuses are:

```text
to_do → pending → in_progress → done
```

New tasks always start in `to_do`. Only the immediately following status is allowed. Backward transitions and status skipping are always rejected by the backend. Same-status requests are successful no-ops and never create an audit event.

## Data model and integrity

### Task

Stores task identity, description, workflow status, operational ownership, priority, due date, source, escalation state, timestamps, and an optional soft-deletion timestamp.

### AuditLog

Stores the immutable task ID, actor snapshot, previous status, new status, and UTC timestamp for each status transition.

### ActivityEvent

Stores the broader append-only operational timeline, including creation, task updates, status changes, escalation requests, escalation resolution, and deletion.

### Atomic status update

The backend performs a status transition inside one database transaction:

1. Read the active task.
2. Return immediately for a same-status no-op.
3. Validate the requested transition.
4. Conditionally update the task using its previous status as a concurrency guard.
5. Append the audit and activity records.
6. Commit all writes together, or roll all of them back.

The conditional update prevents a stale request from silently overwriting a status that changed concurrently.

### Immutability guarantees

History is protected in layers:

1. No HTTP endpoint updates or deletes audit records.
2. Domain code exposes append/read behavior rather than history mutation methods.
3. SQLite `BEFORE UPDATE` and `BEFORE DELETE` triggers abort direct modifications.
4. Task status and history are written in one transaction.
5. Task deletion is soft deletion, so history is retained.
6. Integration tests attempt direct database modification and prove it is rejected.

This is application- and database-level immutability, not cryptographic tamper evidence. A privileged operator who can replace the database or alter its schema can still defeat these controls.

## API reference

Successful JSON responses use `{ "data": ... }`. Errors use `{ "error": { "code", "message", "details?" } }`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/actors` | List predefined actors |
| `GET` | `/api/tasks` | List active tasks |
| `GET` | `/api/tasks/deleted` | List deleted tasks for read-only history access |
| `GET` | `/api/tasks/:id` | Read one active task |
| `POST` | `/api/tasks` | Create a task in `to_do` |
| `PATCH` | `/api/tasks/:id` | Update operational task fields |
| `PATCH` | `/api/tasks/:id/status` | Change status with an explicit actor |
| `DELETE` | `/api/tasks/:id` | Soft-delete a task |
| `GET` | `/api/tasks/:id/audit-logs` | Read chronological status history |
| `GET` | `/api/tasks/:id/activities` | Read one task's complete activity timeline |
| `GET` | `/api/activities` | Filter activity across tasks |
| `GET` | `/api/metrics` | Read operational dashboard metrics |
| `POST` | `/api/tasks/:id/ai-summary` | Generate a factual, optional audit explanation |

Important domain error codes include `VALIDATION_ERROR`, `TASK_NOT_FOUND`, `INVALID_STATUS_TRANSITION`, `CONCURRENT_MODIFICATION`, `AI_INSIGHT_UNAVAILABLE`, and `ROUTE_NOT_FOUND`.

## AI Insights

AI Insights are contextual assistance, not an autonomous agent or a generic chatbot.

### Request flow

1. The user selects **Generate insight** from a task detail panel.
2. The backend loads the verified task and chronological history.
3. Deterministic code calculates transition count, actors, first event, latest event, and current status.
4. If configured, DeepSeek receives the task title, current status, and verified events.
5. DeepSeek returns a short explanation in non-thinking mode.
6. The UI labels the result as AI-generated and keeps the original activity visible.

The provider prompt explicitly forbids inventing motivations, causes, intent, or unsupported events. The AI endpoint has no path to task or audit mutations.

### Failure behavior

- Missing key: return deterministic facts with `available: false`.
- Provider timeout, error, or empty response: return `AI_INSIGHT_UNAVAILABLE` without affecting core features.
- Frontend failure state: show a retry action while keeping verified activity accessible.

## Testing strategy

Development follows TDD around business-critical behavior rather than chasing a superficial coverage percentage.

### Domain tests

- Default one-step-forward policy
- Rejection of backward transitions and status skipping
- Same-status idempotency
- Human-readable transition explanations

### API integration tests

- Task creation with `to_do` as the initial status
- Valid status change and exactly one audit record
- Same-status update without a new log or changed timestamp
- Invalid actor and transition rejection
- Strict forward-only workflow enforcement
- Soft deletion with retained history
- Database rejection of audit update and deletion
- Full transaction rollback when audit insertion fails
- Deterministic AI facts without external network access
- Mocked DeepSeek response and non-thinking request contract

### UI tests

- Task creation and normalized form values
- Workflow preview before explicit save
- Accessible user interactions around the core forms

Automated tests never depend on the real DeepSeek service. Provider behavior is mocked; a live call is a separate manual smoke test.

## Design decisions and trade-offs

### SQLite instead of PostgreSQL

SQLite makes the submission self-contained and gives reviewers real persistence and transactions without infrastructure setup. The cost is serialized writes and limited suitability for sustained concurrent traffic. WAL mode, a busy timeout, short transactions, and compare-and-set updates reduce risk but do not remove that ceiling.

### Optimistic status mutations

Cards move immediately while the request is processed and roll back if the backend rejects the change. This feels responsive while keeping persisted backend state authoritative.

### Actor dropdown without authentication

The dropdown makes actor attribution visible and testable, but it is not an identity boundary. A production service must derive the actor from authenticated server-side identity.

### Soft deletion

Soft deletion preserves traceability and foreign-key relationships. The trade-off is that every active-task query must apply the deletion filter consistently.

### Optional external AI

DeepSeek is isolated behind one endpoint. This preserves progressive enhancement and prevents provider availability from becoming a dependency for core task management.

### Custom visual system

The UI uses a restrained, Billr-inspired workspace treatment with small radii, accessible contrast, a maximum semibold weight, and responsive layouts. Avoiding a large generated component bundle keeps the submission compact while retaining explicit, reviewable interaction behavior.

## Take-home discussion answers

### How do you ensure audit logs cannot be modified?

The application provides no mutation API or repository operation for history. SQLite triggers reject `UPDATE` and `DELETE`, status and history writes occur atomically, soft deletion retains relationships, and integration tests prove direct mutations fail. The limitation is explicit: a privileged database or filesystem administrator can still replace the database or schema.

### What is the riskiest part if many users use the system?

SQLite write contention is the primary technical risk. Concurrent status changes can increase latency or lock failures, although the compare-and-set guard prevents stale updates from silently winning. The largest security risk is actor spoofing because the assignment intentionally excludes authentication.

### What would you refactor first if the system grew?

The first refactor would be the persistence and concurrency boundary: migrate to PostgreSQL, add connection pooling, use row locks or serializable transactions where appropriate, and derive the actor from authenticated identity. The pure workflow policy, validation schemas, and HTTP contract can remain largely stable.

### What would you improve with more time?

- Add Playwright end-to-end coverage for drag-and-drop, keyboard navigation, responsive layouts, and provider failures.
- Add PostgreSQL-backed concurrency and retry tests.
- Add cursor pagination for task and activity history.
- Add authentication, authorization, and server-derived actor identity.
- Add structured logs, traces, metrics, and alerting.
- Add Docker images, CI, and a documented GCP deployment path.
- Add cryptographic chaining or an external write-once audit sink for stronger tamper evidence.

## Limitations and production roadmap

The take-home scope intentionally excludes authentication, authorization, comments, attachments, notifications, multiple projects, custom workflow builders, and real-time multi-user collaboration.

For production scale, the recommended sequence is:

1. PostgreSQL and stronger concurrent-write handling.
2. Authentication and server-derived identities.
3. Cursor pagination and operational observability.
4. Docker packaging and CI/CD.
5. GCP deployment with managed secrets and database services.
6. Redis-backed caching, coordination, or event distribution where measurements justify it.
7. Real-time updates through server-sent events or WebSockets.

MongoDB is not the default migration target because the consistency boundary is naturally relational. If an external requirement mandates MongoDB, status changes and audit append operations must use replica-set transactions and schema/index discipline equivalent to the current guarantees.

## AI usage disclosure

AI assisted with architecture refinement, scaffolding, implementation, test design, debugging, visual iteration, and documentation.

The generated work was validated through:

- direct code review;
- strict TypeScript checks;
- ESLint;
- domain, API integration, and UI tests;
- production builds;
- browser-based smoke testing;
- direct validation of the DeepSeek response contract using synthetic, non-task data.

The candidate should still understand and be able to explain every layer, especially the workflow truth table, transaction boundary, concurrency guard, trigger-based immutability, AI trust boundary, and limitations of SQLite.
