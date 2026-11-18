"use client";

import { useEffect, useState } from "react";

export type KeyStatus = { hasKey: boolean; hint: string | null; addedAt: string | null };

async function call<T>(method: string, body?: unknown): Promise<T> {
  const res = await fetch("/api/settings/anthropic-key", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

/** Loads whether the signed-in person has saved an Anthropic key. */
export function useAnthropicKey() {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  useEffect(() => {
    call<KeyStatus>("GET")
      .then(setStatus)
      .catch(() => setStatus({ hasKey: false, hint: null, addedAt: null }));
  }, []);
  return [status, setStatus] as const;
}

/**
 * Add, replace or remove the person's own Anthropic API key, used by the AI
 * widget builder. The key is checked with Anthropic, stored encrypted, and
 * never shown again: only its last 4 characters.
 */
export function AnthropicKeyForm({
  status,
  onChange,
  compact = false,
}: {
  status: KeyStatus;
  onChange: (status: KeyStatus) => void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(!status.hasKey);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setBusy(true);
    setError(null);
    try {
      const next = await call<KeyStatus>("PUT", { key: value });
      setValue("");
      setEditing(false);
      onChange(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Remove your Anthropic API key? You won't be able to build widgets with AI until you add one again.")) return;
    setBusy(true);
    try {
      onChange(await call<KeyStatus>("DELETE"));
      setEditing(true);
    } finally {
      setBusy(false);
    }
  }

  const explain = (
    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
      The AI widget builder uses your own Anthropic API key, so Anthropic bills your account directly (usually a few cents per widget).
      Create a key at{" "}
      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="font-semibold text-sync-600 underline-offset-2 hover:underline">
        console.anthropic.com
      </a>
      . It&apos;s stored encrypted and only used to build your widgets.
    </p>
  );

  if (!editing && status.hasKey) {
    return (
      <div className="space-y-2">
        {!compact && explain}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-900/10 px-3.5 py-2.5 text-sm dark:border-white/10">
          <span className="text-slate-800 dark:text-slate-200">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Key ending in <span className="font-mono font-semibold">{status.hint}</span>
            {status.addedAt && (
              <span className="text-slate-500 dark:text-slate-400"> · added {new Date(status.addedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
            )}
          </span>
          <span className="flex gap-3 text-xs font-semibold">
            <button type="button" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white" onClick={() => setEditing(true)}>
              Replace
            </button>
            <button type="button" className="text-red-600 hover:text-red-700" disabled={busy} onClick={remove}>
              Remove
            </button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {explain}
      {/* Not a <form>: this can sit inside another form (the widget dialog). */}
      <div className="flex gap-2">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          className="field font-mono text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (value.trim()) void save();
            }
          }}
          placeholder="sk-ant-…"
          aria-label="Anthropic API key"
        />
        <button type="button" className="btn-primary shrink-0" disabled={busy || !value.trim()} onClick={() => save()}>
          {busy ? "Checking…" : "Save key"}
        </button>
        {status.hasKey && (
          <button type="button" className="btn-ghost shrink-0" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
