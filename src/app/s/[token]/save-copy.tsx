"use client";

import { useState } from "react";
import { IconCheck, IconCopy, IconPencil } from "@/components/icons";

type State = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; pageId: string } | { kind: "error"; message: string; upgrade: boolean };

/**
 * "Save a copy": signed-in visitors get the page added to their SyncPads in
 * one click; everyone else goes to sign up and comes straight back here.
 */
export function SaveCopy({ token, signedIn, size = "md" }: { token: string; signedIn: boolean; size?: "md" | "lg" }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const big = size === "lg" ? "px-5 py-2.5 text-base" : "";

  if (!signedIn) {
    // Plain <a>: a full page load into the sign-up flow.
    return (
      <a href={`/signup?next=${encodeURIComponent(`/s/${token}`)}`} className={`btn-primary ${big}`}>
        <IconCopy size={15} />
        Save a copy
      </a>
    );
  }

  if (state.kind === "saved") {
    return (
      <a href={`/app?page=${encodeURIComponent(state.pageId)}`} className={`btn-primary ${big}`}>
        <IconCheck size={15} />
        Saved. Open it
      </a>
    );
  }

  async function save() {
    setState({ kind: "saving" });
    try {
      const res = await fetch(`/api/shared/${encodeURIComponent(token)}/copy`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Couldn't save a copy. Please try again.", upgrade: data.upgrade === true });
        return;
      }
      setState({ kind: "saved", pageId: data.pageIds?.[0] ?? "" });
    } catch {
      setState({ kind: "error", message: "Couldn't reach SyncPads. Check your connection and try again.", upgrade: false });
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={save} disabled={state.kind === "saving"} className={`btn-primary ${big}`}>
        <IconCopy size={15} />
        {state.kind === "saving" ? "Saving…" : "Save a copy"}
      </button>
      {state.kind === "error" && (
        <span className="max-w-xs text-right text-xs text-red-600" role="alert">
          {state.message}{" "}
          {state.upgrade && (
            <a href="/pricing" className="font-semibold underline">
              See plans
            </a>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * "Edit this page" on an edit link: signed-in visitors join and land on the page
 * in their workspace; everyone else signs up (or in) and comes straight back here.
 */
export function JoinToEdit({ token, signedIn, size = "md" }: { token: string; signedIn: boolean; size?: "md" | "lg" }) {
  const [state, setState] = useState<{ kind: "idle" | "joining" } | { kind: "error"; message: string }>({ kind: "idle" });
  const big = size === "lg" ? "px-5 py-2.5 text-base" : "";

  if (!signedIn) {
    return (
      <a href={`/signup?next=${encodeURIComponent(`/s/${token}`)}`} className={`btn-primary ${big}`}>
        <IconPencil size={15} />
        Edit this page
      </a>
    );
  }

  async function join() {
    setState({ kind: "joining" });
    try {
      const res = await fetch(`/api/shared/${encodeURIComponent(token)}/join`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ kind: "error", message: data.error ?? "Couldn't open this page for editing. Please try again." });
      window.location.assign(`/app?page=${encodeURIComponent(data.pageId)}`);
    } catch {
      setState({ kind: "error", message: "Couldn't reach SyncPads. Check your connection and try again." });
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={join} disabled={state.kind === "joining"} className={`btn-primary ${big}`}>
        <IconPencil size={15} />
        {state.kind === "joining" ? "Opening…" : "Edit this page"}
      </button>
      {state.kind === "error" && (
        <span className="max-w-xs text-right text-xs text-red-600" role="alert">
          {state.message}
        </span>
      )}
    </span>
  );
}
