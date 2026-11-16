import { handle } from "@/server/api";
import { geocode } from "@/server/widgets";

// Place search for the weather widget.
export function GET(request: Request) {
  return handle(request, async () => ({ places: await geocode(new URL(request.url).searchParams.get("q") ?? "") }));
}
