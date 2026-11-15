/**
 * Page templates: each one is a valid page, and creating a page from one
 * gives the right groups, links and notes. The DB part runs when TEST_DATABASE_URL is set.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PAGE_TEMPLATES } from "@/lib/page-templates";
import { parseSyncPadsFile } from "@/lib/syncpads-file";
import { normalizeUrl } from "@/lib/url";

describe("page templates", () => {
  it("have unique ids and are valid pages with https links", () => {
    expect(new Set(PAGE_TEMPLATES.map((t) => t.id)).size).toBe(PAGE_TEMPLATES.length);
    expect(PAGE_TEMPLATES.map((t) => t.id)).not.toContain("blank"); // reserved for "start empty"
    for (const t of PAGE_TEMPLATES) {
      expect(() => parseSyncPadsFile({ format: "syncpads", version: 1, pages: [{ ...t.page, name: t.name }] }), t.id).not.toThrow();
      expect(t.page.groups.length, t.id).toBeGreaterThan(0);
      for (const g of t.page.groups) {
        expect(g.items.length, `${t.id}/${g.name}`).toBeGreaterThan(0);
        for (const item of g.items) {
          if (item.type === "link") {
            expect(item.url.startsWith("https://"), item.url).toBe(true);
            expect(normalizeUrl(item.url), item.url).toBeTruthy();
          }
        }
      }
    }
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("creating a page from a template", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let plans: typeof import("@/server/plans");
  const user = crypto.randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    plans = await import("@/server/plans");
    await dbMod.db.insert(schema.users).values({ id: user, email: `${user}@test.local`, name: "T" });
    await sp.ensureUserSetup(user);
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM users WHERE id = ?", [user]);
    await dbMod.pool.end();
  });

  it("fills the page with the template's groups, links and notes, under the chosen name", async () => {
    const template = PAGE_TEMPLATES.find((t) => t.id === "project")!;
    const { id } = await sp.createPageFromTemplate(user, { name: "Acme", template: "project" });
    const page = (await sp.getState(user)).pages.find((p) => p.id === id)!;
    expect(page.name).toBe("Acme");
    expect(page.layout).toBe(template.page.layout);
    expect(page.groups.map((g) => g.name)).toEqual(template.page.groups.map((g) => g.name));
    expect(page.groups.flatMap((g) => g.items.map((i) => i.type))).toEqual(template.page.groups.flatMap((g) => g.items.map((i) => i.type)));
  });

  it("rejects unknown templates and keeps Free limits", async () => {
    await expect(sp.createPageFromTemplate(user, { name: "x", template: "nope" })).rejects.toThrow(/doesn't exist/);
    await sp.createPageFromTemplate(user, { name: "Third", template: "developer" }); // Home + Acme + this = 3
    await expect(sp.createPageFromTemplate(user, { name: "Fourth", template: "design" })).rejects.toBeInstanceOf(plans.PlanLimitError);
  });
});
