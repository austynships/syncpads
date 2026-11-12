/**
 * Removes things that look like secrets from text an agent asks SyncPads to
 * save (PRD: SyncPads never stores passwords). Conversations often contain API
 * keys, tokens and passwords; they're replaced with a placeholder before
 * anything is written, and the agent is told how many were removed.
 *
 * Deliberately errs toward removing: a lost fragment is cheap, a stored key isn't.
 */

export const REDACTED = "[removed: possible secret]";

const PATTERNS: RegExp[] = [
  // Private key blocks
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  // Provider API keys and tokens
  /\bsk-ant-[A-Za-z0-9_-]{20,}/g, // Anthropic
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/g, // OpenAI and similar
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/g, // Stripe
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g, // GitHub
  /\bgithub_pat_[A-Za-z0-9_]{30,}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g, // Slack
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API key
  /\bpa-[A-Za-z0-9_-]{30,}/g, // Voyage AI
  /\bre_[A-Za-z0-9_]{20,}/g, // Resend
  /\bglpat-[A-Za-z0-9_-]{20,}/g, // GitLab
  /\bnpm_[A-Za-z0-9]{30,}/g, // npm
  // JSON web tokens
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // "Bearer <token>"
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/gi,
  // Credentials inside URLs: https://user:pass@host
  /(?<=[a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+(?=@)/gi,
];

// "password: hunter2", "api_key=...", "token = ..." -> keep the label, remove the value.
const LABELED = /\b(pass(?:word|wd|phrase)?|pwd|secret|api[_ -]?key|access[_ -]?key|auth[_ -]?token|token|client[_ -]?secret|private[_ -]?key)(\s*(?:is|=|:)\s*)(["']?)([^\s"',;]{4,})\3/gi;

// Card numbers: 13 to 19 digits (spaces or dashes allowed) that pass the Luhn check.
const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Returns the cleaned text and how many secrets were removed. */
export function redactSecrets(input: string): { text: string; removed: number } {
  let removed = 0;
  let text = input;
  for (const pattern of PATTERNS) {
    text = text.replace(pattern, () => {
      removed++;
      return REDACTED;
    });
  }
  text = text.replace(LABELED, (_m, label: string, sep: string, quote: string, value: string) => {
    if (value === REDACTED || value.startsWith("[removed")) return `${label}${sep}${quote}${value}${quote}`;
    removed++;
    return `${label}${sep}${REDACTED}`;
  });
  text = text.replace(CARD, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 13 || !luhn(digits)) return match;
    removed++;
    return REDACTED;
  });
  return { text, removed };
}

const SENSITIVE_PARAMS = /^(token|access_token|id_token|refresh_token|key|api_key|apikey|secret|client_secret|password|pass|pwd|auth|code|sig|signature|session|sessionid|jwt)$/i;

/** Removes credentials and token-like query parameters from a URL an agent wants to save. */
export function redactUrl(raw: string): { url: string; removed: number } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: raw, removed: 0 };
  }
  let removed = 0;
  if (url.username || url.password) {
    url.username = "";
    url.password = "";
    removed++;
  }
  for (const name of [...url.searchParams.keys()]) {
    if (SENSITIVE_PARAMS.test(name)) {
      url.searchParams.delete(name);
      removed++;
    }
  }
  return { url: url.toString(), removed };
}
