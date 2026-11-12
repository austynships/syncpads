import { describe, expect, it } from "vitest";
import {
  checkLockout,
  clearFailures,
  MAX_FAILURES_PER_EMAIL_IP,
  recordFailure,
  WINDOW_SECONDS,
} from "@/lib/lockout";
import { fakeRedis } from "./helpers/fake-redis";

describe("sign-in lockout", () => {
  it("locks an email+IP after 5 failures and unlocks after 15 minutes", async () => {
    const { store, advance } = fakeRedis();
    for (let i = 0; i < MAX_FAILURES_PER_EMAIL_IP - 1; i++) {
      await recordFailure(store, "a@example.com", "1.1.1.1");
    }
    expect((await checkLockout(store, "a@example.com", "1.1.1.1")).locked).toBe(false);

    await recordFailure(store, "a@example.com", "1.1.1.1");
    const status = await checkLockout(store, "a@example.com", "1.1.1.1");
    expect(status).toEqual({ locked: true, retryAfterSeconds: WINDOW_SECONDS });

    advance(WINDOW_SECONDS);
    expect((await checkLockout(store, "a@example.com", "1.1.1.1")).locked).toBe(false);
  });

  it("normalizes email and does not lock the same email from another IP", async () => {
    const { store } = fakeRedis();
    for (let i = 0; i < 5; i++) await recordFailure(store, " A@Example.com ", "1.1.1.1");
    expect((await checkLockout(store, "a@example.com", "1.1.1.1")).locked).toBe(true);
    expect((await checkLockout(store, "a@example.com", "2.2.2.2")).locked).toBe(false);
  });

  it("locks an IP after 20 failures across different emails", async () => {
    const { store } = fakeRedis();
    for (let i = 0; i < 20; i++) await recordFailure(store, `user${i}@example.com`, "3.3.3.3");
    expect((await checkLockout(store, "new@example.com", "3.3.3.3")).locked).toBe(true);
    expect((await checkLockout(store, "new@example.com", "4.4.4.4")).locked).toBe(false);
  });

  it("clears the email+IP counter on success", async () => {
    const { store } = fakeRedis();
    for (let i = 0; i < 5; i++) await recordFailure(store, "a@example.com", "1.1.1.1");
    await clearFailures(store, "a@example.com", "1.1.1.1");
    expect((await checkLockout(store, "a@example.com", "1.1.1.1")).locked).toBe(false);
  });

  it("does not apply a shared per-IP limit when the IP is unknown", async () => {
    const { store } = fakeRedis();
    for (let i = 0; i < 25; i++) await recordFailure(store, `user${i}@example.com`, null);
    expect((await checkLockout(store, "someone@example.com", null)).locked).toBe(false);
  });
});

