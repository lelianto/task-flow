# TaskFlow

> Track tasks. Understand every change.

TaskFlow is a small internal task manager built for the take-home assignment. It provides a Kanban board, task creation and soft deletion, configurable status transitions, actor selection, and an immutable per-task audit timeline.

## Quick start

Prerequisites: Node.js 22+ and pnpm 10+.

```bash
pnpm install
pnpm db:setup
pnpm dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:3001`. The committed `.env` is intentionally local-only configuration; copy `.env.example` for another environment.

Useful commands:

```bash
pnpm test       # domain, API integration, and UI tests
pnpm typecheck  # strict TypeScript checks
pnpm lint       # ESLint
pnpm build      # production builds
pnpm verify     # all checks above
```

## Architecture

This pnpm monorepo separates responsibilities into three packages:

- `packages/shared`: framework-free domain types and workflow policy.
- `apps/api`: Express API, Zod input validation, domain service, Prisma, and SQLite.
- `apps/web`: React/Vite UI, TanStack Query server state, and dnd-kit interactions.

The backend is the source of truth. Frontend transition checks improve feedback, but every rule is revalidated by the API. Status updates use a database transaction that reads the active task and workflow settings, conditionally updates the task using its old status as a concurrency guard, and appends exactly one audit record. Failure rolls back both writes.

The UI uses pessimistic status updates: a card only moves after the backend confirms the transaction. This is marginally less immediate than optimistic UI but avoids complex rollback behavior and makes data consistency easier to explain.

### API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/actors` | Predefined actors |
| `GET` | `/api/tasks` | List active tasks |
| `GET` | `/api/tasks/:id` | Read an active task |
| `POST` | `/api/tasks` | Create a task in `to_do` |
| `PATCH` | `/api/tasks/:id/status` | Update status with an actor |
| `DELETE` | `/api/tasks/:id` | Soft-delete a task |
| `GET` | `/api/tasks/:id/audit-logs` | Read chronological audit history |
| `GET` | `/api/settings/workflow` | Read workflow settings |
| `PATCH` | `/api/settings/workflow` | Update workflow settings |

Success responses use `{ "data": ... }`; errors use `{ "error": { "code", "message", "details?" } }`.

## Workflow and assumptions

Statuses are ordered `to_do → pending → in_progress → done`. New tasks always start in `to_do`.

Both optional workflow toggles default to **off**, so the initial behavior strictly meets the required one-step-forward flow. Enabling backward transitions permits one step backward. Enabling skipping permits multiple stages in an otherwise allowed direction. Enabling both permits any different status. A same-status request is always a successful no-op and creates no audit log.

Other assumptions:

- Authentication is intentionally out of scope. The actor is selected from `john.doe`, `jane.smith`, and `alex.chen` and validated on the backend.
- Only status changes are audited; creation and deletion are not.
- Delete is soft delete. Deleted tasks disappear from active task endpoints, while their audit rows remain.
- Timestamps are persisted in UTC and rendered in the browser's local timezone.
- Workflow settings are global and affect future transitions only.

## How audit logs are protected

Audit logs are append-only at two levels. The application exposes only create/read operations and the task repository has no update/delete behavior. More importantly, SQLite `BEFORE UPDATE` and `BEFORE DELETE` triggers abort direct mutations. A status update and its log insert share one transaction, so they either both commit or both roll back. Integration tests execute update/delete operations directly against the database and prove the triggers reject them.

This is application/database-level immutability, not cryptographic tamper evidence. A privileged database administrator could still remove triggers or replace the database file. A regulated system would add restricted database roles and an external append-only or hash-chained audit sink.

## Trade-offs

- **SQLite over PostgreSQL:** excellent zero-setup review experience and real transactional persistence, but only one writer at a time. WAL mode, a busy timeout, short transactions, and a compare-and-set update reduce risk; they do not make SQLite ideal for a high-write multi-user service.
- **Global workflow settings:** deliberately simple and appropriate for one internal workspace. Per-project workflows would require explicit tenancy and versioning.
- **Actor dropdown without auth:** makes the required audit information visible and testable, but actors can be spoofed. This must not be mistaken for an identity boundary.
- **Soft delete:** preserves audit relationships and supports traceability, at the cost of applying `deletedAt` filters consistently.
- **Custom CSS rather than a generated component bundle:** keeps the submission compact while retaining accessible labels, native controls, keyboard-capable drag/drop, and responsive behavior.

## Main risk with many users

The first risk is write contention and concurrent status changes. SQLite serializes writes; sustained concurrent traffic would increase latency and lock failures. The compare-and-set guard prevents a stale transition from silently winning, but clients would still need retry/refetch handling. The second risk is actor spoofing because there is no authentication. Both are acceptable for this local take-home scope, not for production collaboration software.

## What I would refactor first at scale

I would replace SQLite with PostgreSQL and introduce an explicit persistence boundary around status transitions. PostgreSQL row locking or serializable transactions, connection pooling, and authenticated actor identity would address the most material risks. The pure workflow policy and HTTP contract can remain stable. Next I would add workflow versioning, cursor pagination for audit history, structured observability, and contract/end-to-end tests.

## Testing strategy

The implementation followed TDD around the highest-value rules:

1. Pure unit tests specify every workflow mode and idempotency.
2. API integration tests cover creation, atomic status/audit behavior, invalid actor and transition rejection, configurable rules, soft deletion, retained history, and database trigger enforcement.
3. React Testing Library covers the task-creation interaction; domain rules are intentionally tested below the UI where they are deterministic.
4. `pnpm verify` runs lint, strict type checking, all tests, and both production builds.

For a longer engagement I would add Playwright journeys for drag-and-drop, keyboard status updates, API failure behavior, and responsive layouts, plus a deterministic two-connection concurrency stress test.

## AI disclosure

AI assisted with architecture refinement, scaffolding, implementation, test-case generation, styling, and documentation. The output was validated by reading the resulting code, enforcing strict TypeScript and lint rules, running automated domain/API/UI tests, executing production builds, and manually exercising the application. The candidate should still review every layer and be able to explain the transaction boundary, compare-and-set concurrency guard, workflow truth table, and audit-trigger limitations.

## If more time were available

- Add full browser E2E and accessibility checks.
- Add audit pagination and an archived-task view.
- Add authenticated users and derive the actor server-side.
- Add PostgreSQL-backed concurrency tests and observability.
- Add deploy configuration and CI verification.
