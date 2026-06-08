# Multi-User Isolation and User-Configured Provider Plan

## Strategy Change

The app should move from a deployment-level OpenAI configuration to a user-scoped configuration model.

Each authenticated user must configure their own upstream provider settings, including:

- `base_url`
- `api_key`
- model preferences and allowlist-effective model selection
- MCP servers and credentials
- custom function definitions and execution endpoints
- connector credentials
- file/vector-store resources
- code interpreter container/file access policy

The server must treat every conversation, tool configuration, external credential, uploaded file, vector store, generated container file, and connector token as owned by one user. Browser state may cache UI preferences, but durable configuration and sensitive data must live server-side with user ownership and encryption where appropriate.

## Current Code Audit Notes

These notes reflect the current repository state before implementing this plan.

### Already User-Scoped

- OIDC/PocketID login exists.
- Sessions are backed by Postgres session token hashes for the main app auth.
- `users`, `sessions`, `conversations`, `messages`, `usage_events`, and `user_quotas` exist.
- Conversation APIs call `requireUser()` and scope reads/writes by `user.id`.
- `/api/turn_response` requires an authenticated user and validates `conversationId` ownership.
- Admin APIs exist for users and quotas.

### Still Global or Insufficiently Isolated

- `lib/openai.ts` creates OpenAI clients from global `OPENAI_API_KEY` and `OPENAI_BASE_URL`.
- Vector store routes use the global OpenAI client and do not require user auth or persist ownership metadata.
- Container file download uses `process.env.OPENAI_API_KEY` directly and accepts arbitrary `file_id` / `container_id` query params without a local ownership check.
- Tool settings are persisted in browser `localStorage` through `stores/useToolsStore.ts`; MCP server URLs and tool settings are not durable, auditable, or user-scoped on the server.
- Conversations store `tools_state`, but this can contain raw client-provided IDs/config and should not be trusted as an authorization source.
- Custom functions are hardcoded in `config/tools-list.ts` and `config/functions.ts`; they are deployment-owned instead of user-configured.
- Function execution currently happens client-side after streaming tool calls through `lib/assistant.ts`, then calls local app routes. This makes per-user server policy and secret handling awkward.
- MCP configuration is supplied by the browser and passed into Responses API tool definitions. There is no server-side user-owned MCP profile table, encrypted secrets, or approval policy persistence.
- Code interpreter is enabled with `{ type: "code_interpreter", container: { type: "auto" } }`; generated `container_id` / `file_id` references are not registered locally before download.
- Google connector tokens are partly stored in cookies and in an in-memory map in `lib/session.ts`; they are not durable encrypted user-owned connector credentials.

## Goals

- Let each user configure their own provider `base_url` and encrypted `api_key`.
- Add a first-class conversation sidebar for multiple conversations.
- Guarantee context isolation between conversations for the same user.
- Guarantee tenant isolation between users across conversations, files, tools, provider keys, MCP, functions, connectors, and code interpreter artifacts.
- Store all sensitive credentials encrypted at rest.
- Move durable tool configuration from browser-local state to user-owned server records.
- Keep admins able to manage availability, quotas, and policy without exposing users' secrets.
- Preserve the existing OIDC and Postgres foundation.

## Non-Goals

- Do not write implementation code as part of this planning change.
- Do not build a custom identity provider.
- Do not let users access other users' provider keys, conversations, files, vector stores, container files, MCP configs, connector tokens, or function configs.
- Do not rely on client-provided IDs or browser-local state as proof of ownership.
- Do not expose decrypted `api_key`, MCP secrets, connector tokens, or function secrets back to the browser.

## Tracking

### Completed

- [x] Audited the current auth, conversation, OpenAI client, file/vector-store, MCP, functions, connector token, and code interpreter paths.
- [x] Rewrote this plan around per-user provider configuration and broader isolation boundaries.
- [x] Added encrypted user provider settings for `base_url` and `api_key`.
- [x] Refactored OpenAI client creation to require `userId` and load that user's decrypted provider settings server-side.
- [x] Added multi-conversation sidebar and explicit conversation switching.
- [x] Enforced conversation context isolation in frontend state and server APIs.
- [x] Added user-owned vector store and uploaded file metadata tables.
- [x] Locked file-search routes behind auth and ownership checks.
- [x] Registered code interpreter container files before allowing download.
- [x] Added user-owned MCP profiles with encrypted secrets and persisted approval policy.
- [x] Moved custom function definitions to user-owned configuration.
- [x] Executed custom functions server-side under user/conversation policy.
- [x] Moved connector OAuth tokens into encrypted user-owned storage.

### Pending

- [ ] Update quota and admin policy to work with user-owned provider settings and tools.
- [ ] Add tests for cross-user and cross-conversation isolation.

## Architecture

### Runtime Components

- `web`: Next.js app and API routes.
- `postgres`: durable storage for users, sessions, conversations, messages, quotas, usage, provider settings, tool configs, file metadata, connector credentials, and audit logs.
- `oidc_provider`: PocketID OIDC provider.
- `upstream_ai_provider`: user-selected OpenAI-compatible provider via per-user `base_url` and `api_key`.
- `mcp_servers`: user-configured remote MCP servers.
- `external_function_endpoints`: user-configured function execution targets, where allowed.
- `connectors`: user-authorized OAuth integrations such as Google.

### Provider Settings

Add a user-owned provider configuration layer:

- Each user has one default provider profile at minimum.
- A future version may allow multiple named provider profiles per user.
- `base_url` is stored server-side and validated before use.
- `api_key` is encrypted at rest and only decrypted inside server-side request handling.
- The browser can see metadata such as provider profile name, masked key fingerprint, and configured base URL, but never the raw key.
- `/api/turn_response`, vector-store routes, file upload routes, container file download, model listing, and any OpenAI-compatible API call must create the client from the current user's provider profile.

Recommended first-pass table:

- `user_provider_settings`
  - `user_id uuid primary key references users(id) on delete cascade`
  - `base_url text not null`
  - `api_key_encrypted text not null`
  - `api_key_fingerprint text not null`
  - `default_model text`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

Encryption requirements:

- Add `CREDENTIAL_ENCRYPTION_KEY` for envelope or application-level encryption.
- Use authenticated encryption.
- Never log raw credentials.
- Return only masked/fingerprinted credential metadata.
- Support key rotation through versioned encrypted payloads if practical.

### Conversation Model and Sidebar

The sidebar is now a near-term feature, not a later nice-to-have.

Required sidebar behavior:

- List current user's active conversations.
- Create new conversation.
- Switch active conversation.
- Rename conversation.
- Archive/delete conversation.
- Restore the last selected conversation per user when possible.
- Keep loading and streaming state tied to the active conversation.

Context isolation requirements:

- Each conversation has its own `conversation_items`, `chat_messages`, model, and resolved tool state snapshot.
- Switching conversations must replace all local message/context state.
- A message send must include exactly one server-owned `conversationId`.
- `/api/turn_response` must load the conversation by `(user_id, conversation_id)` and use only that conversation's saved context plus the new user input.
- The server should reject attempts to append items from one conversation into another.
- Streaming updates should be ignored client-side if they arrive for a conversation that is no longer active.

Implementation direction:

- Keep `conversations.user_id` as the primary isolation boundary.
- Treat `conversations.tools_state` as a snapshot for display/resume only, not as authority for file/tool ownership.
- Add API support for sidebar list refresh after create/rename/archive.
- Consider adding `last_active_conversation_id` per user or user preference.

### Files, Vector Stores, and File Search

Current file/vector-store routes must be hardened before multi-user use.

Required changes:

- Require `requireUser()` in all vector store and file routes.
- Create OpenAI clients from the current user's provider settings.
- Persist local ownership metadata for every uploaded upstream file and vector store.
- Check ownership before retrieving, listing, attaching, or using a vector store.
- Check ownership before using a `vector_store_id` in a Responses API file-search tool.
- Avoid trusting vector store IDs from browser localStorage or conversation snapshots.

Recommended tables:

- `user_files`
  - `id uuid primary key`
  - `user_id uuid not null references users(id) on delete cascade`
  - `provider_file_id text not null`
  - `filename text`
  - `purpose text`
  - `mime_type text`
  - `size_bytes bigint`
  - `provider_profile_id uuid`
  - `created_at timestamptz not null default now()`

- `user_vector_stores`
  - `id uuid primary key`
  - `user_id uuid not null references users(id) on delete cascade`
  - `provider_vector_store_id text not null`
  - `name text not null`
  - `provider_profile_id uuid`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

- `user_vector_store_files`
  - `vector_store_id uuid not null references user_vector_stores(id) on delete cascade`
  - `file_id uuid not null references user_files(id) on delete cascade`
  - `created_at timestamptz not null default now()`

### Code Interpreter and Container Files

Code interpreter currently creates automatic containers and can return container file citations. Those artifacts must be associated with the user and conversation before download.

Required changes:

- Keep code interpreter enablement as a user/conversation tool setting subject to admin policy.
- During streaming completion, capture `container_id`, `file_id`, filename, and conversation ownership for generated files.
- Store generated container file metadata locally.
- Require auth and ownership checks in `/api/container_files/content`.
- Download container files using the current user's provider profile, not global env credentials.
- Restrict downloads to files generated by the same user, and preferably the same conversation.

Recommended table:

- `user_container_files`
  - `id uuid primary key`
  - `user_id uuid not null references users(id) on delete cascade`
  - `conversation_id uuid references conversations(id) on delete cascade`
  - `provider_container_id text`
  - `provider_file_id text not null`
  - `filename text`
  - `mime_type text`
  - `provider_profile_id uuid`
  - `created_at timestamptz not null default now()`

### MCP

MCP configuration must be user-owned. Browser-provided MCP config can be used for draft editing, but not as the final source of truth for execution.

Required changes:

- Add user MCP profile CRUD APIs.
- Store server URL, label, allowed tools, approval policy, and credentials server-side.
- Encrypt bearer tokens, headers, OAuth credentials, or any MCP secret material.
- Let users select which MCP profile is enabled for a conversation.
- Server resolves selected MCP profile by `(user_id, profile_id)` before calling Responses API.
- Persist approval responses by user/conversation/tool call where needed.
- Admin policy can disable MCP globally or restrict allowed server domains, but should not expose user secrets.

Recommended tables:

- `user_mcp_profiles`
  - `id uuid primary key`
  - `user_id uuid not null references users(id) on delete cascade`
  - `server_label text not null`
  - `server_url text not null`
  - `allowed_tools jsonb not null default '[]'::jsonb`
  - `approval_policy text not null`
  - `secrets_encrypted text`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

- `mcp_approval_events`
  - `id uuid primary key`
  - `user_id uuid not null references users(id) on delete cascade`
  - `conversation_id uuid references conversations(id) on delete cascade`
  - `mcp_profile_id uuid references user_mcp_profiles(id) on delete set null`
  - `tool_name text`
  - `arguments jsonb`
  - `approved boolean not null`
  - `created_at timestamptz not null default now()`

### Custom Functions

Custom functions should be configured by the user, not hardcoded deployment-wide.

Required changes:

- Replace hardcoded `toolsList`/`functionsMap` as the only available function source.
- Add user-owned function definitions with JSON schema, description, execution type, and encrypted secrets.
- Execute function calls server-side after validating ownership, enabled state, schema, quotas, and admin policy.
- Do not let browser code execute privileged functions or hold function secrets.
- Persist function call outputs into the correct conversation only.

Recommended function execution modes:

- `http`: server calls a user-configured HTTPS endpoint with validated arguments.
- `builtin`: deployment-provided safe built-ins that users may enable per policy.

Recommended table:

- `user_functions`
  - `id uuid primary key`
  - `user_id uuid not null references users(id) on delete cascade`
  - `name text not null`
  - `description text not null`
  - `parameters_schema jsonb not null`
  - `execution_type text not null`
  - `endpoint_url text`
  - `secrets_encrypted text`
  - `enabled boolean not null default true`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

### Connectors and OAuth Tokens

Connector credentials must follow the same user-scoped encrypted storage rule.

Required changes:

- Move Google OAuth token storage out of cookie/in-memory-only storage.
- Store connector token sets encrypted and keyed by `user_id`.
- Refresh tokens server-side.
- Never expose raw access or refresh tokens to the browser.
- Let users revoke connector access.
- Use connector tools only when the current user has an active connector credential.

Recommended table:

- `user_connector_credentials`
  - `id uuid primary key`
  - `user_id uuid not null references users(id) on delete cascade`
  - `connector text not null`
  - `token_set_encrypted text not null`
  - `scope text`
  - `expires_at timestamptz`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

## Authorization Rules

- Every protected route resolves the current authenticated user server-side.
- Every user-owned row includes `user_id`.
- Every external resource ID accepted from the browser is mapped to a local row owned by `current_user.id`.
- Conversations are scoped by `(user_id, conversation_id)`.
- Files and vector stores are scoped by `(user_id, local_resource_id)` and then mapped to upstream provider IDs server-side.
- Container file downloads require a local row owned by the current user.
- MCP profiles are scoped by `(user_id, mcp_profile_id)`.
- Function definitions are scoped by `(user_id, function_id/name)`.
- Connector credentials are scoped by `(user_id, connector)`.
- Admin routes may inspect metadata and policy, but must not reveal decrypted user secrets.

Optional hardening:

- Enable Postgres Row Level Security for user-owned tables.
- Add audit logs for admin reads/writes and credential changes.
- Add CSRF protection for state-changing cookie-auth routes.
- Add rate limits for login, chat, file upload, credential update, and connector auth endpoints.

## API Direction

### Provider Settings

- `GET /api/user/provider-settings`
  - Returns base URL, default model, and masked key metadata.

- `PUT /api/user/provider-settings`
  - Validates and stores base URL.
  - Encrypts and stores API key.
  - Updates key fingerprint.

- `POST /api/user/provider-settings/test`
  - Uses the current user's provider settings server-side to verify connectivity.

### Conversations

- `GET /api/conversations`
  - Sidebar list for current user.

- `POST /api/conversations`
  - Creates a new isolated conversation.

- `GET /api/conversations/:id`
  - Loads one user-owned conversation and its state.

- `PATCH /api/conversations/:id`
  - Rename/archive/update metadata for one user-owned conversation.

- `DELETE /api/conversations/:id`
  - Archive or delete one user-owned conversation.

- `PUT /api/conversations/:id/state`
  - Save state only after server validates the conversation belongs to the user.

### Chat Turns

- `POST /api/turn_response`
  - Requires authenticated user.
  - Requires user-owned `conversationId`.
  - Loads current user's provider settings.
  - Loads conversation-owned context.
  - Resolves enabled tools from server-owned user configuration.
  - Validates quotas and admin policy.
  - Streams response.
  - Persists final assistant/tool items to the same conversation.
  - Registers generated files/container artifacts.
  - Records usage.

### Files and Vector Stores

- `GET /api/user/files`
- `POST /api/user/files`
- `GET /api/user/vector-stores`
- `POST /api/user/vector-stores`
- `POST /api/user/vector-stores/:id/files`
- `GET /api/user/vector-stores/:id/files`
- `GET /api/container_files/content`

All routes require auth and local ownership checks.

### MCP

- `GET /api/user/mcp-profiles`
- `POST /api/user/mcp-profiles`
- `PATCH /api/user/mcp-profiles/:id`
- `DELETE /api/user/mcp-profiles/:id`
- `POST /api/user/mcp-profiles/:id/test`

### Custom Functions

- `GET /api/user/functions`
- `POST /api/user/functions`
- `PATCH /api/user/functions/:id`
- `DELETE /api/user/functions/:id`
- `POST /api/user/functions/:id/test`

### Connectors

- `GET /api/user/connectors`
- `POST /api/user/connectors/:connector/auth`
- `GET /api/user/connectors/:connector/callback`
- `DELETE /api/user/connectors/:connector`

## Frontend Changes

### Settings

- Add user provider settings UI:
  - base URL input
  - API key input/update
  - masked key status
  - connection test
  - default model

- Move durable tool config out of local-only storage:
  - file search resource picker
  - MCP profiles
  - function definitions
  - connector status
  - code interpreter toggle and policy status

### Sidebar

- Add a persistent conversation sidebar to the main app.
- Show loading/error/empty states for conversation list.
- Support create, select, rename, archive/delete.
- Keep active conversation visible and stable during streaming.

### Chat

- On conversation switch, hydrate message state from the selected conversation.
- Disable send while the selected conversation is loading.
- Associate streaming events with the initiating conversation.
- Prevent stale streams from mutating a newly selected conversation.

## Quotas and Admin Policy

Quota checks remain server-side, but must account for user-owned provider settings and tools.

Before every Responses API call:

1. Load current user.
2. Verify user is enabled.
3. Load current user's provider settings.
4. Load effective quotas and admin policy.
5. Validate selected model.
6. Resolve server-owned tool configuration.
7. Validate requested files/vector stores/MCP/functions/connectors are owned by the user.
8. Check request and token limits.
9. Reject before upstream calls if over limit or unauthorized.

Admin policy should support:

- allowed provider base URL domains or patterns
- allowed models
- allowed tools
- MCP enabled/disabled
- custom functions enabled/disabled
- code interpreter enabled/disabled
- file upload size/count limits
- connector availability

Admins should see metadata, status, usage, and policy results, but not decrypted user credentials.

## Security Checklist

- Encrypt `api_key`, MCP secrets, connector tokens, and function secrets at rest.
- Never expose decrypted secrets to the browser.
- Never log decrypted secrets.
- Scope every resource query by `user_id`.
- Do not trust browser-provided upstream IDs.
- Use local ownership tables as the bridge to upstream provider IDs.
- Use per-user provider settings for every upstream API call.
- Require auth on all file/vector-store/container-file routes.
- Register generated code interpreter files before download.
- Persist MCP approval decisions/audit events.
- Execute custom functions server-side.
- Add CSRF protection for state-changing routes.
- Add rate limiting for credential updates and expensive tool calls.
- Consider RLS for user-owned tables.

## Implementation Phases

### Phase 1: Credential and Provider Foundation

- [x] Add encryption helper and `CREDENTIAL_ENCRYPTION_KEY` validation.
- [x] Add provider settings migration.
- [x] Add user provider settings APIs.
- [x] Refactor `createOpenAIClient` to accept a user/provider context.
- [x] Update model listing and `/api/turn_response` to use user provider settings.

### Phase 2: Conversation Sidebar and Context Isolation

- [x] Add sidebar UI and conversation list state.
- [x] Implement create/select/rename/archive flows.
- [x] Ensure conversation switches fully replace local context.
- [x] Add stale-stream guards keyed by conversation ID.
- [ ] Add tests for cross-conversation isolation.

### Phase 3: File, Vector Store, and Code Interpreter Isolation

- [x] Add file/vector-store/container-file metadata tables.
- [x] Require auth on all file/vector-store routes.
- [x] Map local IDs to upstream IDs server-side.
- [x] Validate ownership in file-search tool construction.
- [x] Register code interpreter generated files.
- [x] Protect container file downloads with ownership checks.

### Phase 4: User-Owned MCP and Function Configuration

- [x] Add MCP profile tables and APIs.
- [x] Add custom function tables and APIs.
- [x] Build tool definitions from server-owned user configuration.
- [x] Move function execution server-side.
- [x] Persist MCP approval events.

### Phase 5: Connector Credential Storage

- [x] Move Google token storage into encrypted user-owned database rows.
- [x] Add connector status/revoke APIs.
- [x] Refresh connector tokens server-side.
- [x] Ensure connector tools are only emitted for the current user's active credential.

### Phase 6: Admin Policy, Audit, and Hardening

- Expand admin policy for provider domains, tools, files, MCP, functions, connectors, and code interpreter.
- Add audit logs for credential/config changes.
- Add rate limits and CSRF protections.
- Add isolation tests and route-level regression tests.

## Open Questions

- Should each user have exactly one provider profile, or multiple named profiles?
- Should `base_url` be unrestricted, admin-allowlisted, or limited to OpenAI-compatible trusted domains?
- Should file/vector-store resources be shareable between conversations for the same user?
- Should code interpreter generated files be downloadable across all of a user's conversations, or only from the originating conversation?
- Which custom function execution modes are allowed first: HTTPS endpoint only, built-ins only, or both?
- Should admins be able to see conversation content, or only usage/resource metadata?
- What is the expected credential encryption key rotation process?
