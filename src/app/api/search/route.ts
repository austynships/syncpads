import { z } from "zod";
import { handle } from "@/server/api";
import { search } from "@/server/search";

const params = z.object({
  q: z.string().trim().min(1, "Type something to search for.").max(200),
  pageId: z.string().max(36).optional(),
  tag: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

// Search links and notes by keyword and meaning (SP-14).
export function GET(request: Request) {
  return handle(request, ({ userId }) => {
    const { q, pageId, tag, limit } = params.parse(Object.fromEntries(new URL(request.url).searchParams));
    return search(userId, { query: q, pageId, tag, limit });
  });
}
