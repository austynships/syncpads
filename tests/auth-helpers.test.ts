import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/client-ip";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("uses Argon2id and verifies correctly", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword({ hash, password: "correct horse battery" })).toBe(true);
    expect(await verifyPassword({ hash, password: "wrong password" })).toBe(false);
  });
});

describe("client IP", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.2" });

  it("reads the first X-Forwarded-For entry behind a trusted proxy", () => {
    expect(getClientIp(headers, true)).toBe("203.0.113.7");
  });

  it("ignores the header when the proxy is not trusted", () => {
    expect(getClientIp(headers, false)).toBeNull();
  });
});

