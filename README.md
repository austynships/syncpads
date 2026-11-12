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

## Deploy with Coolify

The Hostinger KVM 2 server should already run Ubuntu 24.04 with Coolify installed, SSH key login only.

1. **Push this repo to GitHub.** In Coolify, connect the GitHub App so it can deploy on push.
2. **Create the databases** in Coolify (Project → New Resource → Database):
   - **MariaDB**, image `mariadb:11.8`. Note the internal connection URL. Use the `mysql://` scheme: `mysql://user:pass@<internal-host>:3306/syncpads`.
   - **Redis**. Note its internal URL.
3. **Create the app** (New Resource → your GitHub repo). Build pack: **Dockerfile**. Port: **3000**.
4. **Environment variables** (Coolify → app → Environment Variables):

   | Variable | Value |
   | --- | --- |
   | `BETTER_AUTH_URL` | `https://your-domain.com` |
   | `BETTER_AUTH_SECRET` | output of `openssl rand -base64 32` |
   | `DATABASE_URL` | MariaDB internal URL from step 2 |
   | `REDIS_URL` | Redis internal URL from step 2 |
   | `RESEND_API_KEY` | from Resend |
   | `EMAIL_FROM` | e.g. `SyncPads <no-reply@your-domain.com>` |

   `TRUST_PROXY=true` and `RUN_MIGRATIONS_ON_START=true` are already set in the Dockerfile.
5. **Domain:** set your domain on the app in Coolify. Coolify's proxy handles HTTPS certificates.
6. **Deploy.** On startup the container applies any pending migrations, then serves on port 3000. Health check: `GET /api/health`.
7. **Nightly backups (Phase 1 checklist):** in Coolify → MariaDB → Backups, schedule a daily backup (`0 3 * * *`) to an S3-compatible destination (Cloudflare R2 or Backblaze B2), kept for 30 days. Test a restore before launch.

### Why `TRUST_PROXY` matters

Behind Coolify, every request reaches the app from the proxy. The lockout reads the real client IP from the first `X-Forwarded-For` entry. Coolify's Traefik and Caddy both ignore any `X-Forwarded-For` sent by clients and set their own, so that entry can be trusted. Don't set `TRUST_PROXY=true` if the app is exposed without a proxy in front of it. If you later put Cloudflare in front, revisit this.

## Accounts and keys you need

- **Resend** (resend.com): create an API key and verify your sending domain (DNS records). Without a verified domain, Resend only delivers to your own address.
- **Domain**: needed for `BETTER_AUTH_URL`, HTTPS and the Resend sender. Whether syncpads.com is available is still an open question in the PRD.
- **GitHub**: repository for Coolify to deploy from.
- **S3-compatible storage** (Cloudflare R2 or Backblaze B2): for nightly backups.

## Privacy policy note

Account deletion removes all of a user's data from the live database immediately. **Nightly off-server backups are kept for 30 days**, so a deleted account can still exist in a backup for up to 30 days after deletion. The privacy policy should say so.

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

