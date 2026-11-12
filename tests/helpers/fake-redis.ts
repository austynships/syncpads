import type { LockoutStore } from "@/lib/lockout";

/** Minimal in-memory stand-in for the Redis commands the lockout uses. */
export function fakeRedis() {
  let now = 0;
  const data = new Map<string, { value: string; expiresAt: number }>();
  const live = (key: string) => {
    const entry = data.get(key);
    if (entry && entry.expiresAt <= now) data.delete(key);
    return data.get(key);
  };
  const store: LockoutStore = {
    async get(key) {
      return live(key)?.value ?? null;
    },
    async set(key, value, _ex, seconds) {
      if (live(key)) return null; // NX
      data.set(key, { value, expiresAt: now + seconds * 1000 });
      return "OK";
    },
    async incr(key) {
      const entry = live(key) ?? { value: "0", expiresAt: Infinity };
      entry.value = String(Number(entry.value) + 1);
      data.set(key, entry);
      return Number(entry.value);
    },
    async ttl(key) {
      const entry = live(key);
      return entry ? Math.ceil((entry.expiresAt - now) / 1000) : -2;
    },
    async del(key) {
      return data.delete(key) ? 1 : 0;
    },
  };
  return { store, advance: (seconds: number) => (now += seconds * 1000) };
}

