/**
 * Encryption for secrets people give SyncPads (their own Anthropic API key).
 * AES-256-GCM with a random IV per value; the key is derived (HKDF-SHA256) from
 * KEY_ENCRYPTION_SECRET, or BETTER_AUTH_SECRET when that isn't set. A database
 * copy alone can't be decrypted. Stored as "v1:<iv>:<tag>:<ciphertext>" (base64url).
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function key(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("No encryption secret is configured (KEY_ENCRYPTION_SECRET or BETTER_AUTH_SECRET).");
  return Buffer.from(hkdfSync("sha256", secret, "syncpads", "syncpads:user-secrets:v1", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

/** Returns null when the value can't be decrypted (wrong secret, or tampered with). */
export function decryptSecret(stored: string): string | null {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
