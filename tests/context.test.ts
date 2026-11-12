/**
 * Saving and reading conversation context (save_context, get_context, How I work)
 * through the real /mcp route, against MariaDB (runs when TEST_DATABASE_URL is set).
 */
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", () => {
  const counters = new Map<string, number>();
  const incr = async (key: string) => {
    counters.set(key, (counters.get(key) ?? 0) + 1);
    return counters.get(key)!;
  };
  return {
    redis: {
      incr,
      expire: async () => 1,
      multi() {
        const ops: (() => Promise<unknown>)[] = [];
        const chain = {
          incr(key: string) {
            ops.push(() => incr(key));
            return chain;
          },
          expire() {
            ops.push(async () => 1);
            return chain;
          },
          async exec() {
            const out: [null, unknown][] = [];
            for (const op of ops) out.push([null, await op()]);
            return out;
          },
        };
        return chain;
      },
    },
  };
});

const url = process.env.TEST_DATABASE_URL;
const verifier = "context-test-verifier-0123456789abcdefghijklmnop";
const challenge = createHash("sha256").update(verifier).digest("base64url");

describe.skipIf(!url)("conversation context", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let oauth: typeof import("@/server/oauth");
  let agentsMod: typeof import("@/server/agents");
  let mcp: typeof import("@/app/mcp/route");
  const user = crypto.randomUUID();
  let clientId = "";
  let access = "";
  let agentId = "";
  let workId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    oauth = await import("@/server/oauth");
    agentsMod = await import("@/server/agents");
    mcp = await import("@/app/mcp/route");
    // Pro: these tests cover agent writes, which are a Pro feature (Free limits are in billing.test.ts).
    await dbMod.db.insert(schema.users).values({ id: user, email: `${user}@test.local`, name: "T", plan: "pro" });
    await sp.ensureUserSetup(user);
    workId = (await sp.createPage(user, { name: "Acme" })).id;
    const acmeGroup = (await sp.getState(user)).pages.find((p) => p.id === workId)!.groups[0].id;
    await sp.createItem(user, { groupId: acmeGroup, type: "link", url: "https://analytics.example.com/acme", title: "Acme analytics" });

    clientId = (await oauth.registerClient({ client_name: "Claude", redirect_uris: ["https://claude.ai/cb"] })).client_id;
    const check = await oauth.validateAuthorizeRequest(
      new URLSearchParams({ client_id: clientId, redirect_uri: "https://claude.ai/cb", response_type: "code", code_challenge: challenge, code_challenge_method: "S256" }),
    );
    if (!check.ok) throw new Error("bad request");
    const code = new URL(await oauth.approveAuthorization(user, check.request, "read_add")).searchParams.get("code")!;
    access = (await oauth.exchangeCode({ id: clientId }, new URLSearchParams({ code, code_verifier: verifier }))).access_token;
    agentId = (await oauth.verifyAccessToken(access))!.agentId;
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM users WHERE id = ?", [user]);
    await dbMod.pool.query("DELETE FROM oauth_clients WHERE id = ?", [clientId]);
    await dbMod.pool.end();
  });

  async function tool(name: string, args: Record<string, unknown> = {}) {
    const res = await mcp.POST(
      new Request("http://localhost:3000/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2025-06-18",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      }),
    );
    const result = (await res.json()).result as { content: { text: string }[]; isError?: boolean };
    const text = result.content[0].text;
    return { text, json: text.includes("{") ? JSON.parse(text.slice(text.indexOf("{"))) : null, isError: Boolean(result.isError) };
  }

  const conversation = {
    title: "Acme redesign: colors and fonts",
    summary: "We compared three palettes for the Acme site.\n\nThe client prefers the warmer option. Staging password is hunter2-acme for now.",
    decisions: ["Use the warm palette", "Headings in Plus Jakarta Sans"],
    open_questions: ["Does Acme need a dark mode?"],
    links: [
      { url: "https://coolors.co/palette/abc", title: "Warm palette" },
      { url: "https://staging.acme.example.com/?token=SECRET123", title: "Staging site" },
    ],
    page_id: "",
    reason: "You asked me to save this conversation",
  };

  it("lists the new tools and refuses save_context without that permission", async () => {
    const list = await mcp.POST(
      new Request("http://localhost:3000/mcp", {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    const names = (await list.json()).result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(["add_link", "get_context", "get_page", "list_pages", "save_context", "search"]);

    const denied = await tool("save_context", { ...conversation, page_id: workId });
    expect(denied.isError).toBe(true);
    expect(denied.text).toMatch(/can't save context/);
  });

  it("saves a distilled note to the inbox with secrets removed and the source shown", async () => {
    await agentsMod.updateAgent(user, agentId, { permission: "read_add_context" });
    const saved = await tool("save_context", { ...conversation, page_id: workId });
    expect(saved.json).toMatchObject({ status: "saved_to_inbox", page: "Acme", secrets_removed: 2 });
    expect(saved.json.message).toMatch(/2 things that looked like a secret/);

    const { inbox } = await sp.getState(user);
    expect(inbox).toHaveLength(1);
    const note = inbox[0];
    expect(note).toMatchObject({ type: "note", title: "Acme redesign: colors and fonts", agentName: "Claude", pageId: workId });
    expect(note.noteBody).toContain("<h3>Acme redesign: colors and fonts</h3>");
    expect(note.noteBody).toContain("<li>Use the warm palette</li>");
    expect(note.noteBody).toContain("Does Acme need a dark mode?");
    expect(note.noteBody).toContain('href="https://coolors.co/palette/abc"');
    expect(note.noteBody).toContain("Saved by Claude");
    expect(note.noteBody).not.toContain("hunter2"); // password removed
    expect(note.noteBody).not.toContain("SECRET123"); // token query parameter removed
    expect(note.noteBody).toContain("https://staging.acme.example.com/");

    await sp.approveInboxItem(user, note.id, {});
    const acme = (await sp.getState(user)).pages.find((p) => p.id === workId)!;
    const approved = acme.groups[0].items.find((i) => i.type === "note")!;
    expect(approved).toMatchObject({ title: "Acme redesign: colors and fonts", savedBy: "Claude" });
  });

  it("gives every agent the user's How I work notes and relevant saved context", async () => {
    await sp.updateSettings(user, { contextProfile: "Freelance designer. Client: Acme. Keep answers short." });
    const ctx = await tool("get_context", { topic: "acme" });
    expect(ctx.json.how_i_work).toEqual({ written_by: "the user", text: "Freelance designer. Client: Acme. Keep answers short." });
    expect(ctx.json.pages.map((p: { name: string }) => p.name)).toEqual(["Home", "Acme"]);
    expect(ctx.json.recent_context[0]).toMatchObject({ title: "Acme redesign: colors and fonts", saved_by: "Claude", page: "Acme" });
    expect(ctx.json.recent_context[0].text).toContain("Use the warm palette");
    expect(ctx.json.relevant.map((r: { title: string }) => r.title)).toEqual(
      expect.arrayContaining(["Acme analytics", "Acme redesign: colors and fonts"]),
    );

    // Agent notes are marked as such when other agents read the page.
    const page = await tool("get_page", { page_id: workId, format: "markdown" });
    expect(page.text).toContain("Note saved by Claude: Acme redesign: colors and fonts");
  });

  it("logs saves, and undoes them like links", async () => {
    const log = await agentsMod.listActivity(user);
    expect(log.map((e) => e.action)).toEqual(expect.arrayContaining(["save_context", "get_context"]));
    const entry = log.find((e) => e.action === "save_context" && e.canUndo)!;
    expect(entry.after).toMatchObject({ secretsRemoved: 2, page: "Acme" });
    expect(await agentsMod.undoActivity(user, entry.id)).toBe(true);
    const acme = (await sp.getState(user)).pages.find((p) => p.id === workId)!;
    expect(acme.groups[0].items.some((i) => i.type === "note")).toBe(false);
  });
});
