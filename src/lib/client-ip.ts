/**
 * Client IP for the sign-in lockout.
 *
 * Behind Caddy (docker-compose.prod.yml) every request comes from the proxy,
 * so the real client IP is read from X-Forwarded-For. Caddy, by default,
 * ignores an X-Forwarded-For sent by the client and sets it itself, so the
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

