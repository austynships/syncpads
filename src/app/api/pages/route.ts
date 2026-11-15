import { body, handle, schemas } from "@/server/api";
import { createPage, createPageFromTemplate } from "@/server/start-page";

export function POST(request: Request) {
  return handle(request, async ({ userId }) => {
    const input = await body(request, schemas.createPage);
    // A template fills the new page with ready-made groups, links and notes.
    return input.template && input.template !== "blank"
      ? createPageFromTemplate(userId, { name: input.name, template: input.template })
      : createPage(userId, { name: input.name });
  });
}

