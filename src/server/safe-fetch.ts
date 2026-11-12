/**
 * Fetches outside URLs safely (PRD "Abuse": block private IP ranges to prevent
 * server-side request forgery). Used for favicons now and page fetching in Phase 4.
 *
 *  - Only http/https on the default ports.
 *  - Every DNS answer is checked; if any address is private, the request is refused.
 *  - The connection is pinned to the checked address, so DNS can't change in between.
 *  - Redirects are followed manually (max 3) and each hop is checked again.
 *  - Response size and time are capped.
 */
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96], ["2001:db8::", 32],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv6");
}

export function isPrivateAddress(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) is checked as IPv4.
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return blocked.check(mapped[1], "ipv4");
  const family = net.isIP(ip);
  if (family === 4) return blocked.check(ip, "ipv4");
  if (family === 6) return blocked.check(ip, "ipv6");
  return true; // not an IP at all: refuse
}

export class BlockedUrlError extends Error {}

export type SafeResponse = { status: number; contentType: string; body: Buffer; finalUrl: string };

async function resolvePublic(hostname: string): Promise<{ address: string; family: number }> {
  const host = hostname.replace(/^\[|\]$/g, "");
  const answers = net.isIP(host)
    ? [{ address: host, family: net.isIP(host) }]
    : await dns.lookup(host, { all: true, verbatim: true });
  if (answers.length === 0) throw new BlockedUrlError("Host not found");
  for (const a of answers) {
    if (isPrivateAddress(a.address)) throw new BlockedUrlError("Private addresses are not allowed");
  }
  return answers[0];
}

function requestOnce(url: URL, pinned: { address: string; family: number }, maxBytes: number, timeoutMs: number) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        headers: { "User-Agent": "SyncPadsBot/1.0 (+https://syncpads.com)", Accept: "*/*" },
        timeout: timeoutMs,
        // Connect to the address we already checked, whatever DNS says now.
        lookup: (_host, opts, cb) => {
          if ((opts as { all?: boolean }).all) {
            (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [pinned]);
          } else {
            cb(null, pinned.address, pinned.family);
          }
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy(new BlockedUrlError("Response too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new BlockedUrlError("Request timed out")));
    req.on("error", reject);
    req.end();
  });
}

export async function safeFetch(
  input: string,
  { maxBytes = 512 * 1024, timeoutMs = 5000, maxRedirects = 3 } = {},
): Promise<SafeResponse> {
  let url = new URL(input);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError("Only http(s) URLs");
    if (url.port && url.port !== "80" && url.port !== "443") throw new BlockedUrlError("Non-standard port");
    if (url.username || url.password) throw new BlockedUrlError("Credentials in URL");

    const pinned = await resolvePublic(url.hostname);
    const res = await requestOnce(url, pinned, maxBytes, timeoutMs);

    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      url = new URL(res.headers.location, url);
      continue;
    }
    return {
      status: res.status,
      contentType: String(res.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase(),
      body: res.body,
      finalUrl: url.toString(),
    };
  }
  throw new BlockedUrlError("Too many redirects");
}

