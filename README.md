# SyncPads

The start page your AI can use. Product requirements: [syncpads.md](./syncpads.md).

**Status: Phase 1 (Foundation).** This includes sign-up and sign-in, the full database schema, and production deployment. The start page, extension, enrichment and MCP server come in later phases.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- MariaDB 11.8 with Drizzle ORM (MariaDB was chosen for its native `VECTOR` column)
- Redis (sign-in lockout counters now; BullMQ job queues from Phase 4)
- Better Auth for email and password sign-in, Argon2id hashing
- Resend for email

## What's in Phase 1

| Feature | Where |
| --- | --- |
| Sign up with email verification | `/signup` → emailed link → `/app` |
| Sign in, sign out | `/login`, `/app` |
| Password reset by emailed link (1 hour expiry; signs out all sessions) | `/forgot-password` → `/reset-password` |
| Minimum 8-character passwords, Argon2id hashing | `src/lib/password.ts` |
| Lockout: 5 failures per email+IP, or 20 per IP, locks for 15 minutes | `src/lib/lockout.ts`, hooks in `src/lib/auth.ts` |
| 30-day sessions, renewed daily while the user is active | `src/lib/auth.ts` |
| Delete account (requires password, deletes everything immediately) | `/settings` |
| Schema for every PRD table, plus auth tables and `item_embeddings` | `src/db/schema.ts`, `drizzle/` |

There is no magic-link or social sign-in, by design (SP-1).

## What's in Phase 2 (start page)

| Feature | Notes |
| --- | --- |
| Pages (SP-3) | Tabs: click to switch, drag to reorder, double-click to rename. Add with **+**. Column count, rename and delete are in ⚙ Settings. |
| Groups and links (SP-4) | Add, edit and delete. Drag links between groups with the ⠿ handle; drag groups by their handle. **Paste a URL anywhere** to add it to the first group. Deleting shows **Undo**. |
| Layouts and themes (SP-5) | List or tiles per group; light/dark/system theme; wallpapers (built-in gradients, colors, or an https image URL). |
| Notes (SP-11) | Rich-text notes inside groups (Tiptap). Stored as sanitized HTML in `items.note_body`. |
| Fast load (SP-2) | `/app` renders from a localStorage cache first, then syncs. Works offline from the cache. |
| Sync (SP-6) | Every write increments `user_settings.revision`. Clients poll `/api/state/revision` every 5 s and refetch when it changes. |
| Favicons | Fetched by our server and cached in the `favicons` table, so no third party sees users' links. Uses `src/server/safe-fetch.ts`, which blocks private IPs (SSRF), odd ports, big responses and slow servers. |

API routes (all require sign-in, writes must come from the same origin): `GET /api/state`, `GET /api/state/revision`, `PATCH /api/settings`, `POST /api/pages`, `PATCH|DELETE /api/pages/:id`, `PUT /api/pages/order`, `POST /api/groups`, `PATCH|DELETE /api/groups/:id`, `PUT /api/groups/order`, `POST /api/items`, `PATCH|DELETE /api/items/:id`, `POST /api/items/:id/restore`, `PUT /api/items/order`, `GET /api/favicon?host=`. The data logic lives in `src/server/start-page.ts`.

Free plan limits are not enforced yet (Phase 6).

## What's in Phase 3 (saving and import)

| Feature | Notes |
| --- | --- |
| Chrome extension (SP-2, SP-8) | `extension/`: new tab opens SyncPads; popup saves the current page to a chosen page and group, or all tabs as a new group; imports Chrome bookmarks. See `extension/README.md` to install. |
| Import a bookmark file (SP-9) | ⚙ Settings → **Import bookmarks**: an HTML export from Chrome, Edge, Firefox, Safari or start.me. Parsed in the browser (`src/lib/bookmarks.ts`), previewed, then sent to `POST /api/import`. |
| Folder mapping | Top-level folder → page; links directly inside → "Links" group; each subfolder → group, deeper ones named by path ("Work / Clients"); loose top-level links → "Imported" page. Non-web links (bookmarklets, `chrome://`) are skipped. Limits: 10,000 links, 2,000 groups, 100 pages per import. |

Imports add new pages after your existing ones in a single transaction, so a failed import leaves nothing half-done. Imported links have `source = 'import'`. The API accepts writes from browser extensions as well as the site itself (`src/server/api.ts`). start.me's RSS export (OPML) isn't imported yet; that comes with the RSS widget (SP-12).

## Run locally

Requirements: Node.js 22 or newer, and Docker Desktop (for MariaDB and Redis).

```bash
npm install
cp .env.example .env          # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
docker compose up -d          # MariaDB 11.8 on :3306, Redis on :6379
npm run db:migrate            # create the tables
npm run dev                   # http://localhost:3000
```

If `RESEND_API_KEY` is empty, verification and reset emails are **printed in the terminal** running `npm run dev`. Copy the link from there into your browser.

### Tests

```bash
npm test                      # unit tests (lockout, Argon2id, client IP)
npm run typecheck
```

The database tests need MariaDB running:
- **Auth flow test:** runs the real Better Auth handler, with Redis and email faked in memory. It covers sign-up, verification, the 8-character minimum, the Argon2id hash, the lockout, 30-day sessions and account deletion.
- **Account deletion test:** checks that every user-owned table cascades from `users`, and that deleting a user leaves zero rows behind.

Both use `syncpads_test`, which docker-compose creates, and migrate it automatically.

```bash
# macOS/Linux
TEST_DATABASE_URL=mysql://syncpads:syncpads@localhost:3306/syncpads_test npm test
# Windows PowerShell
$env:TEST_DATABASE_URL="mysql://syncpads:syncpads@localhost:3306/syncpads_test"; npm test
```

### Changing the schema

1. Edit `src/db/schema.ts`.
2. Run `npm run db:generate` to write a new SQL file in `drizzle/`, and commit it.
3. Run `npm run db:migrate` locally. Production applies it automatically on the next deploy.

Rule for new tables: any table holding user data needs a `user_id` column with `ON DELETE CASCADE` to `users` (use the `userId()` helper). The account deletion test fails if one is missing.

## Deploy (Ubuntu 24.04 + Docker, no Coolify)

Everything runs with Docker Compose on one server: Caddy (HTTPS) ? app ? MariaDB 11.8 + Redis. See `docker-compose.prod.yml`. A full beginner walkthrough lives outside the repo; the short version:

1. Install Ubuntu 24.04, Docker and a firewall that allows only ports 22, 80 and 443.
2. Point your domain's DNS `A` record at the server.
3. Clone this repo to `/opt/syncpads` on the server. For a private repo, use a read-only GitHub deploy key.
4. `cp .env.production.example .env` and fill it in (generate secrets with `openssl rand -hex 32`).
5. `./scripts/deploy.sh`. This pulls, builds and starts everything. Migrations run when the app starts, and Caddy fetches the HTTPS certificate on its own.
6. Logs: `docker compose -f docker-compose.prod.yml logs -f app`. Health check: `https://your-domain/api/health`.

### Automatic deploys

The server checks GitHub every minute and runs `scripts/deploy.sh` when `main` has a new commit (`scripts/auto-deploy.sh`). The repo is public, so no keys or GitHub secrets are involved. Install it once (the units assume the repo is at `/opt/syncpads`):

```bash
cp deploy/systemd/syncpads-*.service deploy/systemd/syncpads-*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now syncpads-auto-deploy.timer syncpads-backup.timer
```

Deploy log: `journalctl -u syncpads-auto-deploy -n 100`. Pause auto-deploys with `systemctl stop syncpads-auto-deploy.timer`.

### Nightly backups

`scripts/backup.sh` dumps MariaDB to `/var/backups/syncpads` on the server every night at 03:00 UTC (`syncpads-backup.timer`, installed above) and keeps 14 days. These backups live on the same server, so Hostinger's VPS snapshots are the copy that survives losing the server. Test a restore before launch:
`gunzip -c /var/backups/syncpads/<file>.sql.gz | docker compose -f docker-compose.prod.yml exec -T mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" syncpads`

### Why `TRUST_PROXY` matters

Every request reaches the app from Caddy. The lockout reads the real client IP from the first `X-Forwarded-For` entry. Caddy ignores any `X-Forwarded-For` sent by clients and sets its own, so that entry can be trusted. Don't set `TRUST_PROXY=true` if the app is exposed without a proxy in front of it. If you later put Cloudflare in front, revisit this.

## Accounts and keys you need

- **Resend** (resend.com): create an API key and verify your sending domain (DNS records). Without a verified domain, Resend only delivers to your own address.
- **Domain**: needed for HTTPS and the Resend sender.

## Privacy policy note

Account deletion removes all of a user's data from the live database immediately. **Nightly backups are kept for 14 days** (plus any Hostinger VPS snapshots), so a deleted account can still exist in a backup for a while after deletion. The privacy policy should say so.

## Project layout

```
src/
  app/                 pages and API routes (api/auth/[...all] is Better Auth)
  components/          shared UI
  db/schema.ts         all tables
  db/vector.ts         VECTOR insert/search helpers (used from Phase 4)
  lib/auth.ts          Better Auth config, lockout hooks
  lib/lockout.ts       Redis lockout logic
  instrumentation.ts   runs migrations on server start (production)
drizzle/               generated SQL migrations (commit these)
tests/                 vitest tests
```

