# Retro Board

An anonymous team retrospective board — Next.js (App Router) + TypeScript +
Tailwind + shadcn-style UI, now full-stack: sessions persist server-side in
SQLite, members join from a share link, and every client stays in sync over
SSE. Liquid Glass aesthetic, light/dark themes.

## How a session runs

The host creates a session from the dashboard and shares the link
(`/s/<shareToken>`). Guests join anonymously, with a display name, or by
signing in (GitHub OAuth / email magic link) — every participant appears only
under an anonymous alias; emails are never shown in the UI.

Each topic (*Went well*, *Could improve*, *Try next*) runs as its own guided
round:

1. **Write** — a shared timer runs while everyone adds cards. Cards stay
   blurred so nobody gets anchored by others' ideas.
2. **Group** — cards are clustered into themes automatically; the host can
   rename themes, create new ones, or drag cards between groups.
3. **Vote** — members vote per theme with totals hidden. Totals unveil once
   everyone finishes, ranked by votes.

It ends with a results review where top themes become assigned, dated action
items. Boards download as JSON snapshots, and a snapshot can be imported as a
brand-new session.

## Architecture

```
app/                    App Router pages + API routes (app/api/**)
  page.tsx              Landing page
  login/                GitHub / magic-link sign-in
  dashboard/            Host's session list
  new/                  Create a session
  s/[token]/            Share-link entry: join card or live board
components/             Liquid Glass UI (board, dialogs, top-bar, …)
hooks/
  use-retro-board.ts    Local state machine (reducer + 28 action types)
  use-synced-board.ts   Server-synced twin: optimistic reducer dispatches +
                        API calls, SSE state stream with polling fallback
lib/                    types, snapshot import/export, auto-grouping, selectors
server/
  db/types.ts           DAL interface — ALL app code talks to this, never SQL
  db/sqlite.ts          node:sqlite implementation (zero dependencies)
  db/migrate.ts         Applies db/migrations/*.sql on boot
  auth/                 Custom JWT auth: jose HS256, httpOnly cookies,
                        GitHub OAuth callback + email magic links
  session.ts            SerializedSession builder (state + meta)
  realtime.ts           SSE broadcaster (named "state" events)
  api-helpers.ts        Route-handler utilities
db/migrations/          SQLite schema
```

**Realtime model:** the server is the source of truth. Clients apply
optimistic reducer updates for snappy UI, then reconcile from the SSE
`state` stream. If the event stream drops (3 failures in 30s) the client
falls back to polling `GET /api/sessions/[id]` every 5s. The countdown
timer is server-authoritative (`meta.timer`); clients derive the display
from `endsAt` and the host auto-advances when it expires.

**Auth model:** signed session JWT in an httpOnly `rb_session` cookie
(30 days, set by GitHub OAuth or a magic link). Anonymous joiners get a
separate httpOnly `rb_anon` identity cookie (1 year). Edge middleware
(`middleware.ts`) guards `/dashboard/*` and `/new/*`.

## Environment

Copy `.env.example` to `.env` and fill in:

| Variable             | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `AUTH_SECRET`        | HS256 signing key — `openssl rand -hex 32`                   |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials |
| `APP_URL`            | Public base URL, used for OAuth redirects + magic links      |
| `SQLITE_PATH`        | Optional SQLite file location (default `./data/retro-board.db`) |

## Local development

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

**GitHub OAuth app setup** (https://github.com/settings/developers → New OAuth App):

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/github/callback`
- Copy the client ID/secret into `.env`.

On localhost, the email magic-link flow returns a `devLink` you can open
directly (no real email is sent in dev).

### Checks

```bash
pnpm exec tsc --noEmit
pnpm build
```

## Docker

```bash
docker compose up --build   # http://localhost:3000
```

The SQLite file lives in the `./data` bind mount (`/app/data` in the
container), so sessions survive restarts and rebuilds. Put your real values
in `.env` (loaded via `env_file`); never bake secrets into the image.

## Porting the DAL to Postgres

The data-access layer is the `Db` interface in `server/db/types.ts` — route
handlers and session helpers never touch SQL. To run on Postgres:

1. Implement `Db` with parameterized queries (`$1`-style placeholders).
2. Store the JSON blobs (`topics`, `settings`) as `jsonb`; keep booleans as
   native booleans or 0/1 at the edges (helpers `b()`/`n()` already convert).
3. Swap the singleton in `server/db/index.ts` for the new driver.

No call site changes needed.

**Vercel note:** serverless functions have no persistent disk, so the SQLite
driver won't survive between invocations there — deploy with the Postgres
driver instead. Local dev and Docker keep using SQLite with zero setup.
