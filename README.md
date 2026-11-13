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

## What's in Phase 4 (enrichment and search)

| Feature | Notes |
| --- | --- |
| Enrichment worker (SP-13) | `src/worker/main.ts`, its own container (`worker` in `docker-compose.prod.yml`). Fetches each saved link with `safe-fetch` (5 MB, 15 s, private IPs blocked), stores a clean title and a text snapshot, and gives untitled links their page title. Notes are indexed by their own text. |
| Queue | The `item_enrichment` table is the queue (`src/server/enrichment/queue.ts`): rows are written in the same transaction as the item, claimed with `claim_token`, retried with backoff (2, 4, 8 min) and marked `failed` after 4 tries or on a 4xx. Items saved before Phase 4 are queued automatically. |
| Summaries and tags | Claude (`claude-haiku-5-5`, structured output, low effort; override with `ENRICH_MODEL`). Two sentences plus 3 to 6 tags. Page text is labeled as untrusted in the prompt. |
| Search (SP-14) | `GET /api/search?q=&pageId=&tag=&limit=` and the search bar (Ctrl/⌘+K or `/`). Keyword: title, address, tags, summary, note text, and page text through a FULLTEXT index. Meaning: Voyage AI embeddings (`voyage-4`, 1024 dimensions) in the MariaDB `VECTOR` column. The two lists are merged by reciprocal rank fusion. |
| Consent | Settings → **Smart features** is off by default. Page text is sent to Anthropic and Voyage AI only for users who turn it on, and only if the server has `ANTHROPIC_API_KEY` / `VOYAGE_API_KEY`. Turning it on processes links already saved. Without keys, titles, snapshots and keyword search still work. |

## What's in Phase 5 (agent layer)

| Feature | Notes |
| --- | --- |
| MCP server (SP-15) | `https://syncpad.tech/mcp` (`src/app/mcp/route.ts`): Streamable HTTP, stateless, official MCP SDK. Tools: `search`, `get_page` (json or markdown), `list_pages`, `add_link`. Every result that contains saved content starts with an "untrusted data" notice. |
| OAuth 2.1 | `src/server/oauth.ts`. Discovery at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource[/mcp]`; dynamic client registration at `/oauth/register`; consent screen at `/oauth/authorize`; `/oauth/token` (authorization code with PKCE S256 only, refresh tokens rotated on every use) and `/oauth/revoke`. Codes and tokens are stored only as SHA-256 hashes. Replayed codes or refresh tokens revoke that connection. Access tokens last 1 hour, refresh tokens 30 days. |
| Agents (SP-18) | One agent per user + OAuth client. Read only or read and add, optional page scope, auto-approve, disconnect. Pages marked "Hide from AI agents" never appear in any result. Agents can't delete anything. 60 calls a minute and 2,000 a day per agent (10,000 on Pro). |
| Agent Inbox (SP-16) | `add_link` creates an `inbox` item (with the agent's reason) unless auto-approve is on. Inbox button in the top bar: approve into any group, edit the title, or dismiss. |
| Activity log (SP-17) | Every tool call is logged in `activity_log`. Added links can be undone for 30 days. Read-only entries are pruned after 30 days. |
| Agents page | `/agents`: the MCP address, setup steps for Claude, ChatGPT and Cursor, the user's "How I work" notes, connected agents and their controls, and the activity log. |
| Conversation context | `save_context`: an agent saves a distilled note from a chat (title, summary, decisions, open questions, related links) as a note item, into the Agent Inbox unless auto-approve is on. Needs the "Read, add links and save context" permission. Secrets are removed first (`src/server/redact.ts`: provider keys, tokens, JWTs, private keys, labeled passwords, card numbers, URL credentials and token query parameters). Notes show who saved them, and other agents see them labeled as agent-written, untrusted data. |
| How I work | `get_context`: the user's own "How I work" notes (`user_settings.context_profile`, edited on `/agents`), the pages the agent can see, the 5 most recent agent-saved notes, and search results for an optional topic. The server's instructions tell agents to call it first. |

## What's in Phase 6 (plans and billing)

| Feature | Notes |
| --- | --- |
| Plans (SP-20) | `src/server/plans.ts`. Free: 3 pages, 500 links (active + inbox), 1 read-only agent, summaries for the first 100 links, keyword search, 2,000 agent calls a day. Pro: no limits, agents can add links and save context, search by meaning, 10,000 calls a day. A limit blocks only that action (HTTP 402 with `upgrade: true`, shown as a toast with "See plans"); nothing is ever removed. On Free only the oldest connected agent works. |
| Billing | `src/server/billing.ts`. Stripe Checkout to subscribe, the Stripe customer portal to switch monthly/yearly, update the card, see invoices or cancel (at period end). Prices are found by lookup key (`syncpads_pro_monthly` $5, `syncpads_pro_yearly` $48). Deleting an account cancels its subscription first. |
| Webhook | `POST /api/stripe/webhook`, verified by signature. Every event re-reads the subscription from Stripe, so order doesn't matter. `active`, `trialing` and `past_due` mean Pro; anything else means Free. State is mirrored in `subscriptions`. |
| Pages | `/pricing` (public), and a Plan card with usage meters in Account settings. |

### Billing setup (once per Stripe mode)

Put `STRIPE_SECRET_KEY` in the server's `.env`, restart the app and worker, then create the product, prices, customer portal and webhook, writing the webhook's signing secret straight into `.env`:

```bash
cd /opt/syncpads
docker compose -f docker-compose.prod.yml exec -T worker node stripe-setup.cjs | grep '^STRIPE_WEBHOOK_SECRET=' >> .env
docker compose -f docker-compose.prod.yml up -d app
```

It's safe to run again. If `.env` lost the webhook secret, add `--recreate-webhook`. Do this once with the test key, and again when switching to the live key.

Run the worker locally with `npm run worker` (bundles `src/worker/main.ts` to `dist/worker.cjs` and runs it with `.env`).

## Admin dashboard

`/admin` shows revenue (last 24 hours, 7 days and 30 days, net of refunds, from Stripe), MRR, subscribers, users, links, pages, notes and AI agent usage. List admins by email in the server's `.env` as `ADMIN_EMAILS=a@example.com,b@example.com`, then recreate the app (`docker compose -f docker-compose.prod.yml up -d app`). An admin's email must be verified. Everyone else gets a 404 at `/admin`.

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

