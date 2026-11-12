/**
 * Client IP for the sign-in lockout.
 *
 * Behind Coolify's proxy (Traefik or Caddy) every request comes from the proxy,
 * so the real client IP is read from X-Forwarded-For. Both proxies, by default,
 * ignore an X-Forwarded-For sent by the client and set it themselves, so the
 * first entry is the real client. Only trust the header when TRUST_PROXY=true;
 * otherwise anyone could fake their IP.
 *
 * Returns null when the IP is unknown (e.g. local dev without a proxy).
 */
export function getClientIp(
  headers: Headers | undefined | null,
  trustProxy = process.env.TRUST_PROXY === "true",
): string | null {
  if (!headers || !trustProxy) return null;
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || null;
}

