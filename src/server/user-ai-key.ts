/**
 * People's own Anthropic API keys, used to build custom widgets, so building
 * is billed to them by Anthropic. Stored encrypted; only the last 4 characters
 * are ever shown back.
 */
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { decryptSecret, encryptSecret } from "./secrets";
import { InvalidInputError, ensureUserSetup } from "./start-page";

const KEY_FORMAT = /^sk-ant-[A-Za-z0-9_-]{20,250}$/;

export type KeyStatus = { hasKey: boolean; hint: string | null; addedAt: string | null };

export async function anthropicKeyStatus(userId: string): Promise<KeyStatus> {
  const [row] = await db
    .select({ enc: userSettings.anthropicKeyEnc, hint: userSettings.anthropicKeyHint, addedAt: userSettings.anthropicKeyAddedAt })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return { hasKey: Boolean(row?.enc), hint: row?.hint ?? null, addedAt: row?.addedAt?.toISOString() ?? null };
}

/** The decrypted key, for a request on the person's behalf. Null when there's none. */
export async function getAnthropicKey(userId: string): Promise<string | null> {
  const [row] = await db.select({ enc: userSettings.anthropicKeyEnc }).from(userSettings).where(eq(userSettings.userId, userId));
  return row?.enc ? decryptSecret(row.enc) : null;
}

/** Checks the key with Anthropic (a free call that lists models), then stores it encrypted. */
export async function saveAnthropicKey(userId: string, rawKey: string): Promise<KeyStatus> {
  const key = rawKey.trim();
  if (!KEY_FORMAT.test(key)) throw new InvalidInputError("That doesn't look like an Anthropic API key. It starts with sk-ant-.");
  try {
    await new Anthropic({ apiKey: key, maxRetries: 1, timeout: 15_000 }).models.list({ limit: 1 });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new InvalidInputError("Anthropic didn't accept that key. Check it and try again.");
    if (err instanceof Anthropic.PermissionDeniedError) throw new InvalidInputError("That key doesn't have permission to use the API.");
    if (err instanceof Anthropic.APIConnectionError) throw new InvalidInputError("Couldn't reach Anthropic to check the key. Try again in a moment.");
    // Other errors (rate limits, outages) don't mean the key is wrong: save it anyway.
    if (!(err instanceof Anthropic.APIError)) throw err;
  }
  await ensureUserSetup(userId);
  const addedAt = new Date();
  await db
    .update(userSettings)
    .set({ anthropicKeyEnc: encryptSecret(key), anthropicKeyHint: key.slice(-4), anthropicKeyAddedAt: addedAt })
    .where(eq(userSettings.userId, userId));
  return { hasKey: true, hint: key.slice(-4), addedAt: addedAt.toISOString() };
}

export async function removeAnthropicKey(userId: string): Promise<KeyStatus> {
  await db
    .update(userSettings)
    .set({ anthropicKeyEnc: null, anthropicKeyHint: null, anthropicKeyAddedAt: null })
    .where(eq(userSettings.userId, userId));
  return { hasKey: false, hint: null, addedAt: null };
}
