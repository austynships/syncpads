"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconMegaphone } from "@/components/icons";

type Audience = "all" | "free" | "pro" | "people";

const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "free", label: "Free users" },
  { id: "pro", label: "Pro users" },
  { id: "people", label: "Specific people" },
];

/** Write an announcement, preview it as it will look in the bell, and send it. */
export function Compose({ sizes, initialTo = "" }: { sizes: Record<Exclude<Audience, "people">, number>; initialTo?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<Audience>(initialTo ? "people" : "all");
  const [to, setTo] = useState(initialTo);
  const recipients = [...new Set(to.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const reach = audience === "people" ? recipients.length : sizes[audience];
  const canSend = title.trim().length > 0 && !busy && (audience !== "people" || recipients.length > 0);

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const direct = audience === "people";
      const res = await fetch(direct ? "/api/admin/messages" : "/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(direct ? { to, title, body: body || null, link: link || null } : { title, body: body || null, link: link || null, audience }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't send it. Please try again.");
      setTitle("");
      setBody("");
      setLink("");
      if (direct) {
        const notFound = (data.notFound ?? []) as string[];
        setMessage({
          kind: notFound.length && !data.sent ? "error" : "ok",
          text: `Sent to ${data.sent} ${data.sent === 1 ? "person" : "people"}.${notFound.length ? ` No SyncPads account for: ${notFound.join(", ")}.` : ""}`,
        });
        setTo("");
      } else {
        setMessage({ kind: "ok", text: `Sent to ${reach.toLocaleString()} ${reach === 1 ? "person" : "people"}.` });
      }
      router.refresh();
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="rounded-2xl border border-slate-900/[0.07] bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-900">
          Title
          <input
            className="field mt-1"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New: share pages and edit them together"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-900">
          Message <span className="font-normal text-slate-500">(optional)</span>
          <textarea
            className="field mt-1 min-h-24"
            value={body}
            maxLength={1000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Click Share on any page and choose Edit. Whoever opens the link can add to it with you."
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-900">
          Link <span className="font-normal text-slate-500">(optional: where clicking it goes)</span>
          <input className="field mt-1" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/docs/sharing or https://…" />
        </label>
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-900">Send to</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAudience(a.id)}
                aria-pressed={audience === a.id}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                  audience === a.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {a.label}
                {a.id !== "people" && <span className="font-normal opacity-70"> ({sizes[a.id].toLocaleString()})</span>}
              </button>
            ))}
          </div>
        </div>

        {audience === "people" && (
          <label className="mt-4 block text-sm font-medium text-slate-900">
            Email addresses
            <textarea
              className="field mt-1 min-h-20 font-mono text-xs"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="alex@example.com, sam@example.com"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Separate with commas or new lines.{" "}
              {recipients.length > 0 && `${recipients.length} ${recipients.length === 1 ? "address" : "addresses"}. `}
              They get it as a &ldquo;Message from SyncPads&rdquo; in their bell.
            </span>
          </label>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {confirming ? (
            <>
              <span className="text-sm text-slate-700">
                Send to {reach.toLocaleString()} {reach === 1 ? "person" : "people"} now?
              </span>
              <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={!canSend} onClick={send}>
                {busy ? "Sending…" : "Yes, send it"}
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary" disabled={!canSend} onClick={() => setConfirming(true)}>
              <IconMegaphone size={15} />
              {audience === "people" ? "Send message" : "Send announcement"}
            </button>
          )}
          {message && (
            <span className={`text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-red-600"}`} role="status">
              {message.text}
            </span>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Preview in the bell</p>
        <div className="overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white shadow-sm">
          <div className="border-b border-slate-900/[0.07] px-4 py-3 text-sm font-bold text-slate-900">Notifications</div>
          <div className="flex gap-3 bg-sync-500/[0.04] px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sync-500/15 text-sync-600">
              <IconMegaphone size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wider text-sync-600">
                {audience === "people" ? "Message from SyncPads" : "What's new"}
              </span>
              <span className="block text-sm font-semibold leading-snug text-slate-900">{title || "Your title"}</span>
              {body && <span className="mt-0.5 block whitespace-pre-line text-xs leading-relaxed text-slate-500">{body}</span>}
              <span className="mt-1 block text-[11px] text-slate-400">Just now</span>
            </span>
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sync-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Retract a sent announcement (with a confirm step). */
export function Retract({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function retract() {
    setBusy(true);
    await fetch(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  return confirming ? (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <button type="button" className="text-xs text-slate-500 hover:text-slate-900" onClick={() => setConfirming(false)}>
        Cancel
      </button>
      <button type="button" className="text-xs font-semibold text-red-600 hover:text-red-700" disabled={busy} onClick={retract} aria-label={`Retract ${title}`}>
        {busy ? "Retracting…" : "Retract"}
      </button>
    </span>
  ) : (
    <button type="button" className="text-xs font-medium text-slate-500 hover:text-red-600" onClick={() => setConfirming(true)}>
      Retract
    </button>
  );
}
