/** Encrypting people's API keys: round trip, unique per value, tamper-evident, tied to the secret. */
import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/server/secrets";

describe("secrets", () => {
  const before = process.env.KEY_ENCRYPTION_SECRET;
  afterEach(() => {
    process.env.KEY_ENCRYPTION_SECRET = before;
  });

  it("encrypts and decrypts, with a fresh IV each time", () => {
    process.env.KEY_ENCRYPTION_SECRET = "one-secret";
    const a = encryptSecret("sk-ant-example");
    const b = encryptSecret("sk-ant-example");
    expect(a).not.toBe(b);
    expect(a).not.toContain("sk-ant");
    expect(decryptSecret(a)).toBe("sk-ant-example");
  });

  it("returns null when tampered with or the secret changes", () => {
    process.env.KEY_ENCRYPTION_SECRET = "one-secret";
    const stored = encryptSecret("sk-ant-example");
    const parts = stored.split(":");
    const flipped = parts[3][0] === "A" ? "B" : "A";
    expect(decryptSecret([parts[0], parts[1], parts[2], flipped + parts[3].slice(1)].join(":"))).toBeNull();
    expect(decryptSecret("garbage")).toBeNull();
    process.env.KEY_ENCRYPTION_SECRET = "another-secret";
    expect(decryptSecret(stored)).toBeNull();
  });
});
