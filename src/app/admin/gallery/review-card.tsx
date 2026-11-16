"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CustomWidgetFrame } from "@/components/start/custom-widget-frame";

type Widget = {
  id: string;
  name: string;
  description: string;
  html: string;
  prompt: string | null;
  status: string;
  installs: number;
  reports: number;
  reviewNote: string | null;
  createdAt: string;
  authorName: string;
  authorEmail: string;
  reportReasons: string[];
};

type Decision = "publish" | "reject" | "remove";
const LABEL: Record<Decision, string> = { publish: "Approve", reject: "Reject", remove: "Remove" };

/** One gallery widget for review: a live (sandboxed) preview, who made it and why, and the decision buttons. */
export function ReviewCard({ widget, actions }: { widget: Widget; actions: Decision[] }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [showCode, setShowCode] = useState(false);

  async function decide(decision: Decision) {
    if (decision !== "publish" && !confirm(`${LABEL[decision]} “${widget.name}”? The author is told${note ? " with your note" : ""}.`)) return;
    setBusy(decision);
    await fetch(`/api/admin/gallery/${encodeURIComponent(widget.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note: note || null }),
    }).catch(() => null);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-slate-900/[0.07] bg-white p-4 shadow-sm">
      <div className="mb-3 rounded-xl border border-slate-900/[0.07] bg-slate-50 p-3">
        <CustomWidgetFrame html={widget.html} title={widget.name} maxHeight={320} />
      </div>
      <p className="font-semibold text-slate-900">{widget.name}</p>
      <p className="mt-0.5 text-sm text-slate-600">{widget.description}</p>
      <p className="mt-1 text-xs text-slate-500">
        By {widget.authorName} ({widget.authorEmail}) · {widget.createdAt}
        {widget.status === "published" && ` · ${widget.installs} adds`}
      </p>
      {widget.reports > 0 && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
          <strong>{widget.reports} {widget.reports === 1 ? "report" : "reports"}</strong>
          {widget.reportReasons.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {widget.reportReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {widget.reviewNote && <p className="mt-2 text-xs text-slate-500">Last note: {widget.reviewNote}</p>}
      {widget.prompt && (
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Asked for:</span> {widget.prompt}
        </p>
      )}
      <button type="button" className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-900" onClick={() => setShowCode((s) => !s)}>
        {showCode ? "Hide code" : "Show code"}
      </button>
      {showCode && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{widget.html}</pre>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="field min-w-0 flex-1 py-1.5 text-sm"
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for the author (optional)"
        />
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            disabled={busy !== null}
            onClick={() => decide(a)}
            className={a === "publish" ? "btn-primary" : "btn-secondary text-red-700"}
          >
            {busy === a ? "Saving…" : LABEL[a]}
          </button>
        ))}
      </div>
    </div>
  );
}
