/**
 * Sign-in lockout (SP-1 / Security NFR), stored in Redis.
 *
 *  - login_fail:{email}:{ip}  5 failures in 15 minutes locks that email from that IP.
 *  - login_fail_ip:{ip}       20 failures in 15 minutes, across any emails, locks that IP.
 *
 * The 15-minute window and the lock both come from the key's expiry, so nothing
 * needs cleaning up. Keying by email + IP (not email alone) means a stranger
 * who knows your email can't keep you locked out from your own connection.
 */

export const WINDOW_SECONDS = 15 * 60;
export const MAX_FAILURES_PER_EMAIL_IP = 5;
export const MAX_FAILURES_PER_IP = 20;

/** The subset of ioredis used here, so tests can pass a fake. */
export interface LockoutStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ex: "EX", seconds: number, nx: "NX"): Promise<unknown>;
  incr(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  del(key: string): Promise<number>;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function emailIpKey(email: string, ip: string | null) {
  return `login_fail:${normalizeEmail(email)}:${ip ?? "unknown"}`;
}

function ipKey(ip: string) {
  return `login_fail_ip:${ip}`;
}

export type LockoutStatus = { locked: false } | { locked: true; retryAfterSeconds: number };

/** Call before checking the password. */
export async function checkLockout(
  store: LockoutStore,
  email: string,
  ip: string | null,
): Promise<LockoutStatus> {
  const keys = [emailIpKey(email, ip)];
  const limits = [MAX_FAILURES_PER_EMAIL_IP];
  // The per-IP limit only applies when we actually know the IP.
  if (ip) {
    keys.push(ipKey(ip));
    limits.push(MAX_FAILURES_PER_IP);
  }

  for (let i = 0; i < keys.length; i++) {
    const count = Number((await store.get(keys[i])) ?? 0);
    if (count >= limits[i]) {
      const ttl = await store.ttl(keys[i]);
      return { locked: true, retryAfterSeconds: ttl > 0 ? ttl : WINDOW_SECONDS };
    }
  }
  return { locked: false };
}

/** Call after a failed sign-in (wrong password or unknown email). */
export async function recordFailure(store: LockoutStore, email: string, ip: string | null) {
  const keys = [emailIpKey(email, ip)];
  if (ip) keys.push(ipKey(ip));
  for (const key of keys) {
    // Create the key with its 15-minute expiry only if it doesn't exist, then count.
    await store.set(key, "0", "EX", WINDOW_SECONDS, "NX");
    await store.incr(key);
  }
}

/** Call after a successful sign-in or a completed password reset. */
export async function clearFailures(store: LockoutStore, email: string, ip: string | null) {
  await store.del(emailIpKey(email, ip));
}

export function lockoutMessage(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

