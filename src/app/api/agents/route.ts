import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { handle } from "@/server/api";
import { listAgents } from "@/server/agents";
import { MCP_RESOURCE } from "@/server/oauth";

// Connected agents, the user's pages (for page access) and the MCP address (SP-15, SP-18).
export function GET(request: Request) {
  return handle(request, async ({ userId }) => ({
    mcpUrl: MCP_RESOURCE,
    agents: await listAgents(userId),
    pages: await db
      .select({ id: pages.id, name: pages.name, hiddenFromAgents: pages.hiddenFromAgents })
      .from(pages)
      .where(eq(pages.userId, userId))
      .orderBy(asc(pages.position)),
  }));
}
