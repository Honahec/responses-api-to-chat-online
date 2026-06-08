# OIDC, Postgres, Docker, and GHCR Implementation Plan

## Goals

- Add unified OIDC authentication.
- Authorize users by OIDC group claims:
  - `superadmin`: administrator access.
  - `chat_user`: normal service access.
- Persist chat data in Postgres with strict user isolation.
- Add an admin console for managing users, quotas, usage, and service limits.
- Package the app with Docker and Docker Compose.
- Publish container images to GitHub Container Registry (GHCR).

## Tracking

### Completed

- [x] Drafted the OIDC, Postgres, Docker, and GHCR implementation plan.
- [x] Defined the required OIDC group mapping:
  - `superadmin` -> administrator access.
  - `chat_user` -> normal service access.
- [x] Defined the first-pass Postgres data model for users, sessions, conversations, messages, usage events, quotas, and system settings.
- [x] Defined the Docker packaging and GHCR publishing direction.
- [x] Added the `pg` runtime dependency to prepare for server-side Postgres access.
- [x] Added initial Postgres migration, migration runner, and database helper.
- [x] Added Dockerfile and Docker Compose baseline for app, migration, and Postgres services.
- [x] Configured Next.js standalone output for container builds.
- [x] Added OIDC login, callback, logout, and current-user API foundation.
- [x] Added server-side session storage using Postgres-backed session hashes.
- [x] Added user-scoped conversation APIs for listing, creating, loading, updating, archiving, and saving state.
- [x] Bound Responses API turns to an authenticated user-owned conversation.
- [x] Added PocketID login gate in the frontend.
- [x] Restore the latest server-persisted conversation after page refresh.
- [x] Added admin user and per-user quota APIs.
- [x] Enforced request-count, model allowlist, and tool allowlist quotas before Responses API calls.

### Pending

- [ ] Confirm the OIDC provider and exact group claim path.
- [x] Add database migrations and a migration runner.
- [x] Add Postgres connection helpers.
- [ ] Add repository functions.
- [x] Implement OIDC login, callback, logout, and current-user APIs.
- [x] Replace in-memory/browser-only conversation state with server-persisted conversations.
- [x] Persist conversation snapshots after chat turns.
- [x] Enforce per-user data isolation on every conversation API.
- [ ] Enforce per-user data isolation on every message API.
- [x] Add quota enforcement before Responses API calls.
- [x] Add admin APIs for users, quotas, usage, allowed models, and allowed tools.
- [ ] Add admin UI for users, quotas, usage, allowed models, and allowed tools.
- [x] Add Dockerfile, `.dockerignore`, and Docker Compose files.
- [ ] Add GHCR publishing workflow.
- [ ] Document production deployment and required environment variables.

## Non-Goals

- Do not build a custom identity provider.
- Do not store OIDC passwords or credentials locally.
- Do not let normal users see, query, or administer other users' conversations.
- Do not rely on browser-only localStorage for durable chat history.

## Architecture

### Runtime Components

- `web`: Next.js application.
- `postgres`: Postgres database for sessions, users, conversations, messages, usage, and quotas.
- `oidc_provider`: PocketID OIDC provider.

### Authentication Flow

1. User opens the app.
2. Middleware checks whether the user has an authenticated server session.
3. If not authenticated, redirect to OIDC login.
4. OIDC callback validates:
   - issuer
   - client id
   - state
   - nonce
   - PKCE verifier
   - token signature
5. Server extracts identity claims:
   - `sub`
   - `email`
   - `name`
   - `groups`
6. Server upserts local user record by `(issuer, subject)`.
7. Server grants role:
   - `superadmin` group -> `admin`
   - `chat_user` group -> `user`
   - neither group -> deny access
8. Server creates an HTTP-only session cookie.

### Authorization Model

- Every protected route must resolve the current authenticated user on the server.
- All user-owned data must include `user_id`.
- Normal users can only access rows where `user_id = current_user.id`.
- Admin users can access admin routes and inspect/manage users and quotas.
- Admin routes must check role on the server, not only in the UI.

## Environment Variables

```env
DATABASE_URL=postgres://app:app_password@postgres:5432/responses_app

OIDC_ISSUER_URL=https://idp.example.com/realms/main
OIDC_CLIENT_ID=responses-chat
OIDC_CLIENT_SECRET=...
OIDC_REDIRECT_URI=http://localhost:3000/api/auth/callback
OIDC_GROUPS_CLAIM=groups
OIDC_ADMIN_GROUP=superadmin
OIDC_USER_GROUP=chat_user

SESSION_SECRET=change-me-minimum-32-bytes

OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
```

## Database Schema

### `users`

- `id uuid primary key`
- `issuer text not null`
- `subject text not null`
- `email text`
- `name text`
- `role text not null check (role in ('admin', 'user'))`
- `groups jsonb not null default '[]'`
- `enabled boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- unique index on `(issuer, subject)`

### `sessions`

- `id uuid primary key`
- `user_id uuid not null references users(id) on delete cascade`
- `session_hash text not null unique`
- `expires_at timestamptz not null`
- `created_at timestamptz not null default now()`
- `last_seen_at timestamptz`

Store only a hash of the session token in Postgres. Store the raw session token only in an HTTP-only secure cookie.

### `conversations`

- `id uuid primary key`
- `user_id uuid not null references users(id) on delete cascade`
- `title text not null default 'New chat'`
- `model text not null`
- `tools_state jsonb not null default '{}'`
- `archived boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Index:

- `(user_id, updated_at desc)`

### `messages`

- `id uuid primary key`
- `conversation_id uuid not null references conversations(id) on delete cascade`
- `user_id uuid not null references users(id) on delete cascade`
- `role text not null`
- `item jsonb not null`
- `api_item jsonb`
- `created_at timestamptz not null default now()`

Index:

- `(conversation_id, created_at asc)`
- `(user_id, created_at desc)`

The duplicated `user_id` is intentional. It makes user-scoped queries and defensive authorization checks simpler.

### `usage_events`

- `id uuid primary key`
- `user_id uuid not null references users(id) on delete cascade`
- `conversation_id uuid references conversations(id) on delete set null`
- `model text`
- `input_tokens integer not null default 0`
- `output_tokens integer not null default 0`
- `total_tokens integer not null default 0`
- `request_count integer not null default 1`
- `created_at timestamptz not null default now()`

### `user_quotas`

- `user_id uuid primary key references users(id) on delete cascade`
- `daily_request_limit integer`
- `monthly_request_limit integer`
- `daily_token_limit integer`
- `monthly_token_limit integer`
- `allowed_models jsonb`
- `enabled_tools jsonb`
- `updated_at timestamptz not null default now()`

Null limit means "use system default".

### `system_settings`

- `key text primary key`
- `value jsonb not null`
- `updated_at timestamptz not null default now()`

Suggested keys:

- `default_quotas`
- `allowed_models`
- `allowed_tools`
- `maintenance_mode`

## User Isolation Rules

- A normal user can list only their own conversations.
- A normal user can load only messages where `conversation.user_id = current_user.id`.
- A normal user can send a new turn only for their own conversation.
- A normal user can attach only their own vector stores if vector store metadata is later persisted locally.
- Admin can inspect and manage user records, quotas, and usage, but admin actions must be auditable.

Optional hardening:

- Enable Postgres Row Level Security for user-owned tables.
- Use app-level `current_user_id` checks even if RLS is enabled.
- Add audit log rows for admin reads and writes.

## API Routes

### Authentication

- `GET /api/auth/login`
  - Creates state, nonce, PKCE verifier.
  - Redirects to OIDC authorization endpoint.

- `GET /api/auth/callback`
  - Validates callback.
  - Upserts user.
  - Checks OIDC group authorization.
  - Creates server session.
  - Redirects to `/`.

- `POST /api/auth/logout`
  - Deletes server session.
  - Clears auth cookie.

- `GET /api/auth/me`
  - Returns current user profile and role.

### Conversations

- `GET /api/conversations`
  - Lists current user's conversations.

- `POST /api/conversations`
  - Creates a new conversation.

- `GET /api/conversations/:id`
  - Loads one conversation and its messages.

- `PATCH /api/conversations/:id`
  - Renames or archives a conversation.

- `DELETE /api/conversations/:id`
  - Deletes or archives a conversation.

### Chat Turn

- Extend `POST /api/turn_response`:
  - Requires authenticated user.
  - Requires `conversationId`.
  - Validates ownership.
  - Validates quotas before calling Responses API.
  - Persists user input message.
  - Streams assistant response.
  - Persists final assistant/tool items after completion.
  - Records usage if available.

### Admin

- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `PATCH /api/admin/users/:id`
- `GET /api/admin/users/:id/usage`
- `GET /api/admin/users/:id/quotas`
- `PUT /api/admin/users/:id/quotas`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`

All admin routes require role `admin`.

## Frontend Changes

### Auth UI

- Show login screen when unauthenticated.
- Show current user and logout button after login.
- Hide app content while `/api/auth/me` is loading.
- Show "access denied" if user lacks both required groups.

### Chat UI

- Add conversation sidebar:
  - New chat
  - Conversation list
  - Rename
  - Archive/delete
- Load selected conversation from server.
- Persist every turn to the server.
- Refreshing the page restores the selected conversation.

### Admin UI

- Add `/admin` page visible only to `superadmin`.
- User table:
  - email/name
  - role
  - groups
  - enabled/disabled
  - usage summary
- User detail:
  - current quota
  - request/token usage
  - allowed models
  - enabled tools
- Settings page:
  - default quotas
  - global model allowlist
  - global tool allowlist

## Quota Enforcement

Before every Responses API call:

1. Load user.
2. Verify user is enabled.
3. Load effective quotas:
   - user-specific quota if set
   - otherwise system default
4. Check request count usage for current day/month.
5. Check token usage if token accounting is available.
6. Check selected model against allowed models.
7. Check enabled tools against allowed tools.
8. Reject with `403` or `429` before calling upstream if over limit.

After every completed response:

1. Record usage event.
2. Persist response metadata.
3. Update conversation timestamp.

## Docker Packaging

### Files

- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `docker-compose.prod.yml` or documented production compose overrides

### Image Strategy

- Multi-stage Dockerfile:
  - `deps`: install pnpm dependencies.
  - `builder`: run `pnpm build`.
  - `runner`: minimal runtime with `.next/standalone`.
- Set `next.config.mjs`:

```js
const nextConfig = {
  output: "standalone",
  devIndicators: false,
};
```

### Local Compose Services

- `app`
  - builds local Dockerfile
  - exposes `3000`
  - depends on `postgres`
  - receives env from `.env`

- `postgres`
  - image `postgres:17-alpine`
  - persistent named volume
  - healthcheck

Example service names:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: responses_app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

## Database Migrations

Use one of these approaches:

- Simple SQL migrations in `db/migrations`.
- Or add a migration tool such as Drizzle, Prisma, Kysely, node-pg-migrate, or Knex.

Recommended pragmatic path for this project:

1. Add `db/migrations/0001_init.sql`.
2. Add `scripts/migrate.ts` or `scripts/migrate.mjs`.
3. Run migrations on container startup only through an explicit command:

```bash
pnpm migrate
pnpm start
```

Avoid silently running migrations inside every web process unless the deployment model is single-instance and controlled.

## GHCR Publishing

### Image Name

Use GitHub repository owner/name:

```text
ghcr.io/<owner>/<repo>:<tag>
```

Suggested tags:

- `latest` for main branch.
- Git SHA tag for immutable deploys.
- Semver tag when pushing version tags.

### GitHub Actions Workflow

Create `.github/workflows/docker-ghcr.yml`:

- Trigger:
  - push to `main`
  - push tags `v*.*.*`
  - pull request build without push
- Permissions:
  - `contents: read`
  - `packages: write`
- Steps:
  - checkout
  - setup Docker Buildx
  - login to GHCR using `GITHUB_TOKEN`
  - build image
  - push on main/tags

### Required Repository Settings

- GitHub Actions enabled.
- Package visibility configured as desired.
- Repository has permission to write packages.

## Security Checklist

- Use HTTP-only, Secure, SameSite=Lax cookies.
- Validate OIDC state, nonce, and PKCE.
- Never trust role/group information from the browser.
- Validate group claim shape, because providers may send string arrays, nested objects, or realm-specific structures.
- Store session token hashes, not raw tokens.
- Rotate `SESSION_SECRET` carefully.
- Scope every database query by `user_id` unless route is admin-only.
- Add rate limiting for login and chat turn endpoints.
- Add CSRF protection for state-changing routes if cookie auth is used.
- Do not expose `OPENAI_API_KEY` to the browser.
- Audit admin quota changes.

## Implementation Phases

### Phase 1: Infrastructure Baseline

- Add Dockerfile and `.dockerignore`.
- Add `docker-compose.yml` with app and Postgres.
- Add Postgres connection helper.
- Add initial SQL migrations.
- Add `DATABASE_URL` to `.env.example`.

### Phase 2: OIDC Auth

- Add OIDC config env vars.
- Add auth routes.
- Add session storage in Postgres.
- Add server helper:
  - `getCurrentUser()`
  - `requireUser()`
  - `requireAdmin()`
- Add auth middleware or route-level checks.

### Phase 3: Persistent Conversations

- Add conversation APIs.
- Persist chat messages and API conversation items.
- Update frontend store to hydrate from server.
- Add conversation sidebar.
- Ensure refresh restores current conversation.

### Phase 4: Quotas and Admin

- Add quota tables and usage events.
- Enforce quotas in `/api/turn_response`.
- Add admin APIs.
- Add admin UI.

### Phase 5: GHCR Release

- Add GitHub Actions Docker workflow.
- Build and push image to GHCR.
- Document deployment with published image.

## Open Questions

- PocketID will be used as the OIDC provider.
- What exact PocketID group claim path should be used: `groups` or a PocketID-specific mapped claim?
- Should admins be allowed to read full user conversations, or only usage/quota metadata?
- Should vector store IDs be persisted per user and protected in the app database?
- What are default daily/monthly request and token limits?
- Should a user have multiple conversations, or only one active conversation per browser/session?
- Should deployments run migrations automatically or through a separate release job?
