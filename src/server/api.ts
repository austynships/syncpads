/**
 * Helpers for the start page API routes.
 * Every route goes through `handle`, which checks the session, blocks
 * cross-site writes, validates input and turns errors into plain JSON messages.
 */
import { z, ZodError } from "zod";
import { auth } from "@/lib/auth";
import { BillingUnavailableError } from "./billing";
import { PlanLimitError } from "./plans";
import { InvalidInputError, NotFoundError } from "./start-page";

type Handler = (ctx: { userId: string; request: Request }) => Promise<unknown>;

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/**
 * Writes must come from our own site or a browser extension (defense in depth
 * on top of SameSite cookies). Extensions are allowed because the SyncPads
 * extension calls the API from its popup. This doesn't open a hole: the
 * session cookie only reaches us from an extension the user granted access
 * to this site, and such an extension could already read the cookie itself.
 */
function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin GETs and non-browser clients don't send it
  if (origin.startsWith("chrome-extension://")) return true;
  const allowed = new URL(process.env.BETTER_AUTH_URL ?? request.url).origin;
  return origin === allowed;
}

export async function handle(request: Request, fn: Handler): Promise<Response> {
  try {
    if (request.method !== "GET" && !isAllowedOrigin(request)) {
      return error(403, "Cross-site request blocked.");
    }
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return error(401, "Please sign in.");

    const result = await fn({ userId: session.user.id, request });
    return Response.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ZodError) return error(400, err.issues[0]?.message ?? "Invalid input.");
    if (err instanceof InvalidInputError) return error(400, err.message);
    if (err instanceof PlanLimitError) return Response.json({ error: err.message, upgrade: true }, { status: 402 });
    if (err instanceof BillingUnavailableError) return error(503, err.message);
    if (err instanceof NotFoundError) return error(404, err.message);
    if (err instanceof SyntaxError) return error(400, "Request body must be JSON.");
    console.error("[api]", err);
    return error(500, "Something went wrong. Please try again.");
  }
}

export async function body<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  return schema.parse(await request.json());
}

// ---------- input schemas ----------

const name = z.string().trim().min(1, "Name can't be empty.").max(255, "Name is too long.");
const id = z.string().min(1).max(36);
const ids = z.array(id).max(5000);

// A bookmark tree for import. Titles and URLs are length-capped here and
// cleaned again by planImport; total size is capped by the request check below.
type TreeNode = { title: string; url?: string; children?: TreeNode[] };
const bookmarkNode: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    title: z.string().max(2048).catch(""),
    url: z.string().max(8192).optional(),
    children: z.array(bookmarkNode).max(20_000).optional(),
  }),
);
const bookmarkTree = z
  .array(bookmarkNode)
  .max(20_000)
  .refine((nodes) => countNodes(nodes) <= 40_000, "That bookmark file is too big to import in one go.");

function countNodes(nodes: TreeNode[]): number {
  let n = 0;
  for (const node of nodes) n += 1 + (node.children ? countNodes(node.children) : 0);
  return n;
}

export const schemas = {
  settings: z
    .object({
      theme: z.enum(["system", "light", "dark"]).optional(),
      wallpaper: z
        .discriminatedUnion("type", [
          z.object({ type: z.literal("none") }),
          z.object({ type: z.literal("preset"), value: z.string().max(32) }),
          z.object({ type: z.literal("color"), value: z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a valid color.") }),
          z.object({
            type: z.literal("url"),
            value: z
              .string()
              .max(2048)
              .url("Enter a valid image URL.")
              .refine((v) => v.startsWith("https://"), "Image URL must start with https://"),
          }),
        ])
        .optional(),
      aiEnabled: z.boolean().optional(),
      contextProfile: z.string().max(10_000, "Keep it under 10,000 characters.").nullable().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, "Nothing to update."),

  createPage: z.object({ name }),
  updatePage: z
    .object({
      name: name.optional(),
      layout: z.enum(["auto", "1", "2", "3", "4", "5"]).optional(),
      hiddenFromAgents: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, "Nothing to update."),
  reorderPages: z.object({ ids }),

  createGroup: z.object({
    pageId: id,
    name,
    layout: z.enum(["list", "tiles"]).optional(),
    links: z
      .array(z.object({ url: z.string().max(4096), title: z.string().max(2048).nullish() }))
      .max(500, "That's too many links for one group.")
      .optional(),
  }),

  import: z.object({ tree: bookmarkTree }),
  updateGroup: z
    .object({ name: name.optional(), layout: z.enum(["list", "tiles"]).optional() })
    .refine((v) => Object.keys(v).length > 0, "Nothing to update."),
  reorderGroups: z.object({ pageId: id, ids }),

  createItem: z.object({
    groupId: id,
    type: z.enum(["link", "note"]),
    url: z.string().max(2048).nullish(),
    title: z.string().max(512).nullish(),
    noteBody: z.string().max(200_000, "Note is too long.").nullish(),
  }),
  updateItem: z
    .object({
      url: z.string().max(2048).nullish(),
      title: z.string().max(512).nullish(),
      noteBody: z.string().max(200_000, "Note is too long.").nullish(),
    })
    .refine((v) => Object.keys(v).length > 0, "Nothing to update."),
  reorderItems: z.object({ groupId: id, ids }),

  approveInbox: z.object({ groupId: id.optional(), title: z.string().max(512).nullish() }),
  updateAgent: z
    .object({
      name: name.optional(),
      permission: z.enum(["read", "read_add", "read_add_context"]).optional(),
      autoApprove: z.boolean().optional(),
      pageIds: z.array(id).max(500).nullable().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, "Nothing to update."),
};

