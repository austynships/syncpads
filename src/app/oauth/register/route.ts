import { getClientIp } from "@/lib/client-ip";
import { redis } from "@/lib/redis";
import { OAuthError, registerClient } from "@/server/oauth";
import { json, oauthEndpoint, preflight } from "@/server/oauth-http";

// RFC 7591 dynamic client registration: agents register themselves before asking the user to connect.
export function POST(request: Request) {
  return oauthEndpoint(async () => {
    // At most 30 registrations per address per hour.
    const key = `oauth:register:${getClientIp(request.headers) ?? "unknown"}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);
    if (count > 30) throw new OAuthError("too_many_requests", "Too many registrations. Try again later.", 429);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") throw new OAuthError("invalid_client_metadata", "Body must be JSON.");
    return json(await registerClient(body), 201);
  });
}
export const OPTIONS = preflight;
