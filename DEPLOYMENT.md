# Deployment

## Required Services

- PocketID OIDC provider
- Postgres
- This Next.js app container

## PocketID OIDC

Create an OIDC client in PocketID and configure:

- Redirect URI: `https://your-app.example.com/api/auth/callback`
- Scopes: `openid email profile groups`
- Group claim: `groups`

The app defaults to `OIDC_GROUPS_CLAIM=groups`. PocketID client examples use
the `groups` claim when the `groups` scope is requested.

Required group mapping:

- `superadmin`: administrator access, including `/admin`.
- `chat_user`: normal chat access.

## Environment Variables

```env
DATABASE_URL=postgres://app:app_password@postgres:5432/responses_app

OIDC_ISSUER_URL=https://pocketid.example.com
OIDC_CLIENT_ID=responses-chat
OIDC_CLIENT_SECRET=replace-me
OIDC_REDIRECT_URI=https://your-app.example.com/api/auth/callback
OIDC_GROUPS_CLAIM=groups
OIDC_ADMIN_GROUP=superadmin
OIDC_USER_GROUP=chat_user
OIDC_SCOPES="openid email profile groups"

OPENAI_API_KEY=replace-me
OPENAI_BASE_URL=https://api.openai.com/v1

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-app.example.com/api/google/callback
```

## Local Docker Compose

Copy `.env.example` to `.env`, fill in the values, then run:

```bash
docker compose up --build
```

The compose stack includes:

- `postgres`
- `migrate`
- `app`

The `migrate` service runs SQL migrations before the app starts.

## Production With GHCR

Images are published by GitHub Actions to:

```text
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:sha-<commit>
ghcr.io/<owner>/<repo>:vX.Y.Z
```

Use the immutable SHA tag for production deployments when possible.

Example production compose override:

```yaml
services:
  app:
    image: ghcr.io/<owner>/<repo>:sha-<commit>
    environment:
      DATABASE_URL: postgres://app:app_password@postgres:5432/responses_app
      OIDC_ISSUER_URL: https://pocketid.example.com
      OIDC_CLIENT_ID: responses-chat
      OIDC_CLIENT_SECRET: replace-me
      OIDC_REDIRECT_URI: https://your-app.example.com/api/auth/callback
      OIDC_GROUPS_CLAIM: groups
      OIDC_ADMIN_GROUP: superadmin
      OIDC_USER_GROUP: chat_user
      OPENAI_API_KEY: replace-me
      OPENAI_BASE_URL: https://api.openai.com/v1
```

Run migrations before rolling the app:

```bash
docker compose run --rm migrate
docker compose up -d app
```

## Admin

After logging in with a PocketID user in the `superadmin` group, open:

```text
/admin
```

The admin page can:

- list users
- enable or disable users
- view request/token usage counters
- configure request/token limits
- configure allowed model IDs
- configure enabled tools

## Notes

- The app stores session token hashes in Postgres and the raw session token only in an HTTP-only cookie.
- Chat access requires PocketID membership in `chat_user` or `superadmin`.
- Admin access requires PocketID membership in `superadmin`.
- `OPENAI_BASE_URL` should include the API version path, for example `/v1`, when the provider requires it.
