/**
 * SyncPads database schema (MariaDB 11.8).
 *
 * Rules for every table, now and in later phases:
 *  - Every row that belongs to a user has a `user_id` column with a foreign key
 *    to `users.id` and ON DELETE CASCADE. Deleting a user then removes all of
 *    their data in one statement (SP-1 account deletion). A test enforces this.
 *  - IDs are 36-character strings, matching Better Auth's user IDs.
 *  - Columns are snake_case in the database, camelCase in TypeScript.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  datetime,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  varchar,
} from "drizzle-orm/mysql-core";
import { EMBEDDING_DIMENSIONS, json, mediumblob, vector } from "./types";

// ---------- Shared column helpers ----------

const id = () =>
  varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  datetime("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`);

const updatedAt = () =>
  datetime("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$onUpdate(() => new Date());

/** `user_id` column that cascades when the user is deleted. */
const userId = () =>
  varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

// ---------- Auth tables (managed by Better Auth) ----------

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  // Better Auth expects this column; it stays null because there is no social sign-in.
  image: text("image"),
  // Server-only fields (Better Auth additionalFields with input: false).
  plan: mysqlEnum("plan", ["free", "pro"]).notNull().default("free"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: userId(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** Password hashes live here (provider_id = "credential"), not on users. */
export const accounts = mysqlTable(
  "accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: userId(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 64 }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: datetime("access_token_expires_at", { mode: "date", fsp: 3 }),
    refreshTokenExpiresAt: datetime("refresh_token_expires_at", { mode: "date", fsp: 3 }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

/**
 * Short-lived email verification and password reset tokens.
 * Keyed by identifier (email or token), not user_id; rows expire on their own.
 */
export const verifications = mysqlTable(
  "verifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// ---------- SyncPads tables (PRD "Data model") ----------

export const pages = mysqlTable(
  "pages",
  {
    id: id(),
    userId: userId(),
    name: varchar("name", { length: 255 }).notNull(),
    position: int("position").notNull().default(0),
    // Column count for groups on this page: "auto" (fits the screen) or "1".."5".
    layout: varchar("layout", { length: 32 }).notNull().default("auto"),
    hiddenFromAgents: boolean("hidden_from_agents").notNull().default(false),
    // Secret for the private .md / llms.txt URL (SP-19). Rotating = replacing it.
    mdToken: varchar("md_token", { length: 64 }).unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pages_user_position_idx").on(t.userId, t.position)],
);

// Named `groups` in the database; Drizzle quotes it, since GROUPS is a reserved word in MySQL 8.
export const groups = mysqlTable(
  "groups",
  {
    id: id(),
    userId: userId(),
    pageId: varchar("page_id", { length: 36 })
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    position: int("position").notNull().default(0),
    layout: mysqlEnum("layout", ["list", "tiles"]).notNull().default("list"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("groups_user_id_idx").on(t.userId),
    index("groups_page_position_idx").on(t.pageId, t.position),
  ],
);

export const agents = mysqlTable(
  "agents",
  {
    id: id(),
    userId: userId(),
    name: varchar("name", { length: 255 }).notNull(),
    client: mysqlEnum("client", ["claude", "chatgpt", "cursor", "other"])
      .notNull()
      .default("other"),
    // read: search and read. read_add: also suggest links. read_add_context: also save
    // conversation context (decisions, summaries) as notes.
    permission: mysqlEnum("permission", ["read", "read_add", "read_add_context"]).notNull().default("read"),
    // When on, add_link skips the Agent Inbox (PRD "What happens when an agent adds a link").
    autoApprove: boolean("auto_approve").notNull().default(false),
    lastUsedAt: datetime("last_used_at", { mode: "date", fsp: 3 }),
    // Revoked agents keep their row so the activity log stays intact.
    revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),
    // The OAuth client this connection came from (one agent per user + client).
    clientId: varchar("client_id", { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [index("agents_user_id_idx").on(t.userId), index("agents_client_idx").on(t.clientId)],
);

// ---------- Phase 5: OAuth 2.1 for agent connections (SP-15) ----------

/**
 * Apps registered through dynamic client registration (RFC 7591): Claude,
 * ChatGPT, Cursor... Not user data (any user can connect the same client), so
 * no user_id; allowlisted in the account deletion test.
 */
export const oauthClients = mysqlTable("oauth_clients", {
  id: varchar("id", { length: 64 }).primaryKey(), // client_id
  name: varchar("name", { length: 255 }).notNull(),
  redirectUris: json<string[]>("redirect_uris").notNull(),
  // "none" for public clients (PKCE only); otherwise a hashed client secret.
  authMethod: mysqlEnum("auth_method", ["none", "client_secret_post", "client_secret_basic"]).notNull().default("none"),
  secretHash: varchar("secret_hash", { length: 64 }),
  clientUri: varchar("client_uri", { length: 512 }),
  createdAt: createdAt(),
});

/** One-time authorization codes (10 minutes). Stored hashed. */
export const oauthCodes = mysqlTable("oauth_codes", {
  codeHash: varchar("code_hash", { length: 64 }).primaryKey(),
  clientId: varchar("client_id", { length: 64 })
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: userId(),
  agentId: varchar("agent_id", { length: 36 })
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  redirectUri: varchar("redirect_uri", { length: 2048 }).notNull(),
  codeChallenge: varchar("code_challenge", { length: 128 }).notNull(),
  resource: varchar("resource", { length: 512 }),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  usedAt: datetime("used_at", { mode: "date", fsp: 3 }),
});

/** Access tokens (1 hour) and refresh tokens (30 days, rotated on use). Stored hashed. */
export const oauthTokens = mysqlTable(
  "oauth_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    kind: mysqlEnum("kind", ["access", "refresh"]).notNull(),
    clientId: varchar("client_id", { length: 64 })
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: userId(),
    agentId: varchar("agent_id", { length: 36 })
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    resource: varchar("resource", { length: 512 }),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [index("oauth_tokens_agent_idx").on(t.agentId)],
);

/** Links and notes share one table. */
export const items = mysqlTable(
  "items",
  {
    id: id(),
    userId: userId(),
    groupId: varchar("group_id", { length: 36 })
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", ["link", "note"]).notNull(),
    url: varchar("url", { length: 2048 }),
    title: varchar("title", { length: 512 }),
    // Notes: sanitized HTML from the rich-text editor (converted to Markdown for agents in Phase 5).
    noteBody: mediumtext("note_body"),
    position: int("position").notNull().default(0),
    source: mysqlEnum("source", ["user", "agent", "import"]).notNull().default("user"),
    status: mysqlEnum("status", ["active", "inbox", "trashed"]).notNull().default("active"),
    createdByAgentId: varchar("created_by_agent_id", { length: 36 }).references(
      () => agents.id,
      { onDelete: "set null" },
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("items_user_status_idx").on(t.userId, t.status),
    index("items_group_position_idx").on(t.groupId, t.position),
  ],
);

/**
 * Filled by the enrichment worker (Phase 4, SP-13). Each row is also the
 * worker's job: status "pending" rows are claimed with `claim_token`, retried
 * with backoff via `next_attempt_at`, and given up after a few attempts.
 * A FULLTEXT index on (title, summary, text_snapshot) is added by a custom
 * migration (drizzle/0003_*), since drizzle-kit can't declare one.
 */
export const itemEnrichment = mysqlTable(
  "item_enrichment",
  {
    itemId: varchar("item_id", { length: 36 })
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    userId: userId(),
    status: mysqlEnum("status", ["pending", "processing", "done", "failed"])
      .notNull()
      .default("pending"),
    fetchedAt: datetime("fetched_at", { mode: "date", fsp: 3 }),
    // Clean page title (og:title or <title>).
    title: varchar("title", { length: 512 }),
    // Untrusted page text: always labeled as untrusted when shown to agents.
    textSnapshot: mediumtext("text_snapshot"),
    summary: text("summary"),
    tags: json<string[]>("tags"),
    // When the summary/tags and the embedding were last made (null = not yet).
    summarizedAt: datetime("summarized_at", { mode: "date", fsp: 3 }),
    embeddedAt: datetime("embedded_at", { mode: "date", fsp: 3 }),
    // Job bookkeeping.
    attempts: int("attempts").notNull().default(0),
    nextAttemptAt: datetime("next_attempt_at", { mode: "date", fsp: 3 }),
    claimToken: varchar("claim_token", { length: 36 }),
    claimedAt: datetime("claimed_at", { mode: "date", fsp: 3 }),
    error: varchar("error", { length: 255 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("item_enrichment_user_id_idx").on(t.userId),
    index("item_enrichment_queue_idx").on(t.status, t.nextAttemptAt),
    index("item_enrichment_claim_idx").on(t.claimToken),
  ],
);

/**
 * One embedding per item, stored in a MariaDB VECTOR column.
 * Insert with VEC_FromText() and search with VEC_DISTANCE_COSINE(), always
 * filtered by user_id — helpers live in src/db/vector.ts. No vector index yet:
 * each search scans only one user's rows (user_id index), which is fast at MVP sizes.
 */
export const itemEmbeddings = mysqlTable(
  "item_embeddings",
  {
    itemId: varchar("item_id", { length: 36 })
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    userId: userId(),
    model: varchar("model", { length: 64 }).notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("item_embeddings_user_id_idx").on(t.userId)],
);

export type RssWidgetConfig = { feedUrl: string };

// Notes are `items` rows (type = note) shown inside groups, so widgets are RSS only.
export const widgets = mysqlTable(
  "widgets",
  {
    id: id(),
    userId: userId(),
    pageId: varchar("page_id", { length: 36 })
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", ["rss"]).notNull(),
    config: json<RssWidgetConfig>("config"),
    position: int("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("widgets_user_id_idx").on(t.userId),
    index("widgets_page_position_idx").on(t.pageId, t.position),
  ],
);

/** Last 50 items per RSS feed. */
export const feedItems = mysqlTable(
  "feed_items",
  {
    id: id(),
    userId: userId(),
    widgetId: varchar("widget_id", { length: 36 })
      .notNull()
      .references(() => widgets.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }).notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
    publishedAt: datetime("published_at", { mode: "date", fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [
    index("feed_items_user_id_idx").on(t.userId),
    index("feed_items_widget_published_idx").on(t.widgetId, t.publishedAt),
  ],
);

/** Pages an agent may see. No rows for an agent = all non-hidden pages. */
export const agentScopes = mysqlTable(
  "agent_scopes",
  {
    agentId: varchar("agent_id", { length: 36 })
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    pageId: varchar("page_id", { length: 36 })
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    userId: userId(),
  },
  (t) => [
    primaryKey({ columns: [t.agentId, t.pageId] }),
    index("agent_scopes_user_id_idx").on(t.userId),
  ],
);

/** Every agent action; `before` and `after` make undo possible (SP-17). */
export const activityLog = mysqlTable(
  "activity_log",
  {
    id: id(),
    userId: userId(),
    agentId: varchar("agent_id", { length: 36 }).references(() => agents.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 64 }).notNull(),
    itemId: varchar("item_id", { length: 36 }).references(() => items.id, {
      onDelete: "set null",
    }),
    before: json<unknown>("before"),
    after: json<unknown>("after"),
    reason: text("reason"),
    createdAt: createdAt(),
    undoneAt: datetime("undone_at", { mode: "date", fsp: 3 }),
  },
  (t) => [index("activity_log_user_created_idx").on(t.userId, t.createdAt)],
);

// ---------- Phase 2 additions ----------

export type Wallpaper =
  | { type: "none" }
  | { type: "preset"; value: string } // key of a built-in gradient
  | { type: "color"; value: string } // #rrggbb
  | { type: "url"; value: string }; // https image URL, loaded by the user's browser

/**
 * One row per user: appearance settings plus a revision counter for sync.
 * Every change to a user's pages, groups or items increments `revision`;
 * clients poll it and refetch when it changes (SP-6).
 */
export const userSettings = mysqlTable("user_settings", {
  userId: varchar("user_id", { length: 36 })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: mysqlEnum("theme", ["system", "light", "dark"]).notNull().default("system"),
  wallpaper: json<Wallpaper>("wallpaper"),
  revision: bigint("revision", { mode: "number", unsigned: true }).notNull().default(0),
  // Smart features (summaries, tags, search by meaning). Off until the user
  // turns them on: page text is only sent to AI providers when this is true.
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  // "How I work": the user's standing context, which agents read first (get_context).
  contextProfile: text("context_profile"),
  updatedAt: updatedAt(),
});

/**
 * Shared favicon cache, keyed by host. Not user data: it holds only public
 * site icons, so it has no user_id (allowlisted in the account deletion test).
 */
export const favicons = mysqlTable("favicons", {
  host: varchar("host", { length: 255 }).primaryKey(),
  status: mysqlEnum("status", ["ok", "missing"]).notNull(),
  contentType: varchar("content_type", { length: 100 }),
  data: mediumblob("data"),
  fetchedAt: datetime("fetched_at", { mode: "date", fsp: 3 }).notNull(),
});
