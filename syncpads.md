# SyncPads — Product Requirements Document (MVP)

Nov 11, 2026 · @Austyn Chalifour

## Overview

The SyncPads MVP ships a start.me-quality start page that AI agents can search, read and add to through a hosted MCP server, with the user approving what agents add. This PRD turns the [SyncPads product overview](https://claude.ai/artifact/1rTV5BirU79sUvkTPHwEjk) into buildable requirements for the MVP; V2 and Later items are listed only for scope.

**Tagline:** SyncPads — the start page your AI can use.

**MVP goals**

1. A person can replace their browser's new tab with SyncPads and import their bookmarks or start.me pages in under 5 minutes.
2. A person can connect Claude, ChatGPT or Cursor to SyncPads in one click and have the agent find a saved link by meaning.
3. Every agent write lands in a review inbox, is logged, and can be undone, so users trust agents with their pages.
4. Free and Pro plans are live, with Pro billing working end to end.

## Problem and users

AI agents can't see the links, docs and dashboards a person has already collected, so people re-paste the same context into every chat. Start pages also go stale because nobody maintains them.

| Persona | Who they are | What they need from SyncPads |
| --- | --- | --- |
| AI-heavy builder (primary) | Lives in Claude, ChatGPT, Cursor or Claude Code | Agents that check their saved tools and docs before searching the web |
| Researcher or writer | Collects many sources per topic | Agents that search and add sources, which the person reviews |
| Freelancer or small agency | Juggles many clients' logins, dashboards and docs | One page per client that both the person and their agents can use |
| Current start.me user | Pays about $25/year for a start page | A one-click switch with nothing lost, plus agent access |

The MVP targets the AI-heavy builder first. Teams and agencies are V2 or Later.

## Scope

The MVP is the eight items below; everything else waits for proof that people connect agents.

**In the MVP**

1. New tab page with pages, groups, list and tile layouts, and cloud sync
2. Chrome extension: save the current page and save all tabs; Chrome bookmarks and start.me import
3. Notes and RSS widgets
4. Auto-enrichment on save and search by meaning
5. Hosted MCP server with `search`, `get_page`, `add_link` and `list_pages`, signed in with OAuth
6. Agent Inbox, activity log and per-agent permissions
7. A `.md` and `llms.txt` version of every page
8. Free and Pro plans with billing

**V2:** status and KPI tiles, agent activity widget, Ask SyncPads chat, context packs, REST API and webhooks, link maintenance, public pages and sharing, Firefox and Edge extensions, mobile share sheet.

**Later:** teams, SSO and admin controls; agency white-label client hubs with custom domains; scheduled agent jobs; mobile apps; end-to-end encrypted pages.

**Not doing**

- Storing passwords or acting as a password manager
- Running AI models on SyncPads servers (all AI goes through provider APIs)
- Real-time multi-user editing in the MVP
- Safari extension and native mobile apps in the MVP

## Functional requirements (MVP)

Each requirement has an ID for tickets; P0 must ship for launch, P1 can follow within weeks.

| ID | Requirement | Acceptance criteria | Priority |
| --- | --- | --- | --- |
| SP-1 | Sign up and sign in | Email and password only (no magic links, Google or other social sign-in); email verified on sign-up; password reset by emailed link; minimum 8 characters; sessions last 30 days; account deletion removes all data within 7 days | P0 |
| SP-2 | New tab page | Extension sets SyncPads as the new tab; page renders from cache in under 300 ms, then syncs | P0 |
| SP-3 | Pages | Create, rename, reorder and delete pages; switch with tabs or a sidebar | P0 |
| SP-4 | Groups and links | Create groups; add, edit, move and delete links by drag and drop; paste a URL anywhere to add it | P0 |
| SP-5 | Layouts and themes | List and tile layouts per group; light and dark mode; wallpaper | P0 |
| SP-6 | Cloud sync | A change on one device shows on another within 10 seconds (polling is fine) | P0 |
| SP-7 | Command palette | Cmd/Ctrl+K finds any link, page or action by name | P1 |
| SP-8 | Save from Chrome | Extension saves the current page to a chosen page and group in two clicks; save all open tabs into a new group | P0 |
| SP-9 | Import | Chrome bookmarks, HTML bookmark files and start.me exports keep their folder structure; a 2,000-link import finishes in under 2 minutes | P0 |
| SP-10 | Export | Download everything as HTML, JSON or Markdown | P1 |
| SP-11 | Notes widget | Rich-text notes on any page; agents can read them | P0 |
| SP-12 | RSS widget | Add a feed URL; shows the latest 10 items; refreshes every 30 minutes | P1 |
| SP-13 | Auto-enrichment | On save, fetch the page in the background and store a text snapshot, clean title, 2-sentence summary, tags and an embedding | P0 |
| SP-14 | Search by meaning | The search bar and MCP `search` return results by keyword and by meaning, filterable by page and tag | P0 |
| SP-15 | Connect an agent | Settings shows the MCP URL and one-click setup steps for Claude, ChatGPT and Cursor | P0 |
| SP-16 | Agent Inbox | Links and notes from agents land in an inbox group; approve, edit or dismiss each in one click | P0 |
| SP-17 | Activity log and undo | Every agent action is listed with time, agent and change; any single action can be undone | P0 |
| SP-18 | Per-agent permissions | Each agent is read-only or read-and-add, limited to chosen pages; any page can be hidden from all agents | P0 |
| SP-19 | Machine-readable pages | Each page has a private `.md` and `llms.txt` URL that can be rotated | P1 |
| SP-20 | Plans and billing | Free limits are enforced; Pro upgrade, cancel and receipts work through Stripe | P0 |

## Hosted MCP server

One remote MCP endpoint at `https://mcp.syncpads.com` (Streamable HTTP, stateless) with OAuth 2.1 sign-in, exposing four tools in the MVP.

**Auth.** OAuth 2.1 with PKCE and dynamic client registration, so Claude, ChatGPT and Cursor can connect without the user copying keys. Each connection becomes one named agent with its own permissions (SP-18). Tokens can be revoked from Settings.

| Tool | Inputs | Returns | Permission needed |
| --- | --- | --- | --- |
| `search` | `query`, optional `page_id`, `tag`, `limit` (default 10, max 50) | Links and notes with title, URL, summary, page and group, ranked by keyword and meaning | Read |
| `get_page` | `page_id`, `format` (`json` or `markdown`) | The page's groups, links and notes | Read |
| `list_pages` | none | Pages this agent can see, with IDs and names | Read |
| `add_link` | `url`, optional `title`, `note`, `page_id`, `reason` | The new item, placed in the Agent Inbox unless auto-approve is on | Read and add |

**Rules**

- Every tool result labels saved page text as untrusted data, so agents don't follow instructions hidden inside saved pages.
- Hidden pages and pages outside the agent's scope never appear in any result.
- Rate limit: 60 calls per minute and 2,000 per day per agent on Free; 10,000 per day on Pro.
- Errors use plain messages an agent can act on (for example, "This agent has read-only access").
- Target response time: under 500 ms for `search` and `get_page` at the 95th percentile.

V2 adds `get_link`, `create_group`, `create_page`, `move`, `tag`, `rename`, `add_note`, `update_note`, `get_feed_items`, `post_status`, `check_links` and `get_context_pack`.

## Agent permissions and safety

Agents never change a user's pages without a trace: every write is scoped, reviewed by default, logged and reversible.

**Permission levels (per agent)**

- **Read-only:** `search`, `get_page`, `list_pages`
- **Read and add:** the above plus `add_link`
- **Full edit:** V2, once rename, move and note tools exist

Each agent can be limited to chosen pages. A page marked **Hidden from agents** is invisible to every agent, whatever its scope.

**What happens when an agent adds a link**

1. The MCP server checks the agent's permission and page scope; if either fails, it returns an error and logs the attempt.
2. The link is saved to the user's **Agent Inbox** with the agent's name and its `reason`, unless the user turned on auto-approve for that agent.
3. Enrichment runs as for any saved link.
4. The user approves (moves it to a page), edits, or dismisses it.
5. The activity log records the action; the user can undo it for 30 days.

**Other safeguards**

- Agents cannot delete anything in the MVP.
- SyncPads never stores passwords; links to login pages only.
- Revoking an agent cuts off its token immediately and keeps its log.
- Fetched page text is stored as data and labeled as untrusted in every MCP response.

## Data model

Ten MySQL tables cover the MVP; every row carries `user_id` (later `workspace_id`) so teams can be added without a rewrite.

| Table | Key fields | Notes |
| --- | --- | --- |
| `users` | id, email, name, plan, stripe\_customer\_id, created\_at | One row per account |
| `pages` | id, user\_id, name, position, layout, hidden\_from\_agents, md\_token | `md_token` makes the private `.md` URL |
| `groups` | id, page\_id, name, position, layout | Groups sit on pages |
| `items` | id, group\_id, type (link, note), url, title, note\_body, position, source (user, agent, import), status (active, inbox, trashed), created\_by\_agent\_id | Links and notes share one table |
| `item_enrichment` | item\_id, fetched\_at, text\_snapshot, summary, tags, embedding, status | Filled by the worker; `embedding` stored per the vector decision in Open questions |
| `widgets` | id, page\_id, type (notes, rss), config JSON, position | RSS config holds the feed URL |
| `feed_items` | id, widget\_id, title, url, published\_at | Last 50 per feed |
| `agents` | id, user\_id, name, client (claude, chatgpt, cursor, other), permission, last\_used\_at, revoked\_at | One per OAuth connection |
| `agent_scopes` | agent\_id, page\_id | Pages an agent may see; none = all non-hidden pages |
| `activity_log` | id, user\_id, agent\_id, action, item\_id, before JSON, after JSON, reason, created\_at, undone\_at | `before` and `after` make undo possible |

OAuth tokens, sessions and job queues live in the auth library's tables and Redis, not listed here.

## Architecture and tech stack

The whole MVP runs on one Hostinger KVM 2 server (2 vCPU, 8 GB RAM) managed with Coolify; AI calls, billing and backups are the only outside services.

&#91;embedded content: SyncPads MVP architecture · one server, three outside services\]

Requests come in through Caddy to one Next.js app, which also serves the MCP endpoint. Slow work such as page fetching and embeddings goes through a Redis queue to a separate worker, so saves and agent calls stay fast.

| Layer | Choice |
| --- | --- |
| Web app and API | Next.js (App Router), TypeScript, Tailwind |
| Database | MySQL 8 or MariaDB 11.8, with Drizzle ORM |
| Background jobs | BullMQ on Redis, run as a separate worker process |
| MCP server | Route in the Next.js app using the official MCP TypeScript SDK, Streamable HTTP |
| Auth | Auth.js or Better Auth for users; an OAuth 2.1 provider for agent connections |
| AI | Provider APIs for summaries and embeddings; no models run on the server |
| Extension | Chrome Manifest V3, talks to the SyncPads API |
| Billing | Stripe Checkout and customer portal |
| Hosting | Hostinger KVM 2, Ubuntu 24.04, Coolify deploys from GitHub |
| Monitoring | Outside uptime checks (UptimeRobot or Better Stack) and error tracking (Sentry) |

## Non-functional requirements

The MVP must feel instant as a new tab, keep agents fast, and never lose a user's links.

| Area | Requirement |
| --- | --- |
| Speed | New tab paints from local cache in under 300 ms; MCP `search` under 500 ms at p95; enrichment done within 60 seconds of save |
| Capacity | 500 active users and 20,000 MCP calls a day on one Hostinger KVM 2 without degradation |
| Uptime | 99.5% monthly for the app and MCP server, checked every minute by an outside monitor |
| Backups | Nightly MySQL dump to off-server storage (Cloudflare R2 or Backblaze B2), kept 30 days; a restore tested before launch |
| Security | HTTPS everywhere; passwords hashed with Argon2id; sign-in locked for 15 minutes after 5 failed attempts; OAuth tokens hashed; secrets in Coolify environment variables, never in the repo; SSH key login only |
| Privacy | No user content sent to an AI provider unless AI features are on; account deletion removes data within 7 days; a privacy policy lists every provider used |
| Abuse | Per-agent rate limits; page fetching blocks private IP ranges to prevent server-side request forgery; max 5 MB per fetched page |
| Browsers | Latest Chrome and Edge for the extension; the web app works in current Chrome, Edge, Firefox and Safari |

## Plans and limits

The MVP launches with Free and Pro only, at the prices suggested in the product overview.

|  | Free | Pro |
| --- | --- | --- |
| Price | $0 | $5/month or $48/year |
| Pages | 3 | Unlimited |
| Links | 500 | Unlimited |
| Widgets | Notes, RSS (1 feed) | Notes, RSS (unlimited feeds) |
| Connected agents | 1, read-only | Unlimited, read and add |
| Agent calls | 2,000/day | 10,000/day |
| Auto-enrichment | First 100 links | All links |
| Search by meaning | No (keyword only) | Yes |

When a Free user hits a limit, the action is blocked with a one-line upgrade prompt; nothing already saved is removed. Billing runs through Stripe Checkout and the Stripe customer portal.

## Success metrics

The one number that decides V2 is the share of active users who connect at least one agent. The targets below are first guesses to revisit after launch.

| Metric | Definition | Target, 90 days after launch |
| --- | --- | --- |
| Agent connection rate (gate) | Weekly active users with at least one connected agent ÷ weekly active users | 30% or more |
| Agent usage | MCP calls per connected agent per week | 20 or more |
| Activation | New sign-ups who import or add 20+ links in their first day | 50% or more |
| Retention | Users still opening SyncPads as their new tab in week 4 | 40% or more |
| Inbox trust | Agent-added items approved rather than dismissed | 60% or more |
| Revenue | Paying Pro users | 100 |

**The gate:** if the agent connection rate is below 30% at 90 days, V2 leans harder into the self-maintaining start page and the agency client hub instead of more agent tools, as the product overview says.

## Build plan

Six phases take the MVP from an empty server to a public launch; week counts are estimates for one builder working part time, and no dates are set yet.

1. **Foundation (weeks 1–2):** Hostinger KVM 2 with Coolify, Next.js app, MySQL, Redis, sign-in (SP-1), deploys from GitHub, nightly backups.
2. **Start page (weeks 3–5):** pages, groups, links, layouts, themes, sync (SP-2 to SP-6), notes widget (SP-11).
3. **Saving and import (weeks 6–7):** Chrome extension (SP-8), Chrome and start.me import (SP-9).
4. **Enrichment and search (weeks 8–9):** worker, page fetching, summaries, embeddings, search by meaning (SP-13, SP-14).
5. **Agent layer (weeks 10–12):** MCP server with OAuth (SP-15), permissions, Agent Inbox, activity log and undo (SP-16 to SP-18).
6. **Launch (weeks 13–14):** Stripe plans (SP-20), P1 items that fit, onboarding, docs page, a private beta of 20–50 users, then public launch.

**Launch checklist:** restore from backup tested; uptime monitor live; privacy policy and terms published; Chrome Web Store listing approved.

## Risks and open questions

The biggest risk is that people like the start page but never connect an agent; the gate in Success metrics exists to catch that early.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Few users connect agents | The main differentiator goes unused | Onboarding asks to connect an agent in step 2; one-click guides per client; fall back to the start page and agency hub per the gate |
| start.me copies the agent features | Harder to stand out | Ship fast; go deeper on the inbox, permissions and undo, which are hard to bolt on |
| Prompt injection through saved pages | An agent follows hidden instructions | Label saved text as untrusted in every MCP result; agents cannot delete; inbox review by default |
| AI costs grow with users | Margins shrink on $5/month | Cap enrichment on Free; use small, cheap models for summaries and embeddings; revisit pricing at 100 paid users |
| One server is a single point of failure | Outage takes down the new tab | The new tab works from cache when offline; nightly off-server backups; documented rebuild in Coolify |
| Chrome Web Store review delays | Launch slips | Submit the extension in phase 3, weeks before launch |

**Open questions**

- [ ] Vector search: MariaDB 11.8 vector columns on the server, or a hosted vector store such as Upstash Vector?
- [ ] Which embedding and summary models, and what do they cost per 1,000 saved links?
- [ ] Meter AI usage on Pro, or include it with a fair-use cap?
- [ ] Is a 500-link Free limit too low for people importing from start.me?
- [ ] Auth library: Auth.js or Better Auth, given the MCP server also needs to be an OAuth provider?
- [ ] Domain: is syncpads.com available, or is another domain needed?
