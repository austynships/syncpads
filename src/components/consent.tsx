"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Cookie consent for analytics. SyncPads only needs one essential cookie (the
 * sign-in session), which doesn't need consent. Microsoft Clarity on the public
 * pages is optional: it loads only after the visitor clicks Accept.
 *
 * The choice is kept in this browser (localStorage) for 12 months.
 */
const KEY = "syncpads:consent";
const EVENT = "syncpads:consent-change";
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export type Consent = "accepted" | "declined" | null;

export function readConsent(): Consent {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { value, at } = JSON.parse(raw) as { value: Consent; at: number };
    if (Date.now() - at > MAX_AGE_MS) return null; // ask again after a year
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

function writeConsent(value: Consent) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify({ value, at: Date.now() }));
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** Removes Clarity's cookies (first-party ones on this site). */
function clearAnalyticsCookies() {
  const host = window.location.hostname;
  for (const name of ["_clck", "_clsk", "CLID", "ANONCHK", "MR", "MUID", "SM"]) {
    for (const domain of ["", `; domain=${host}`, `; domain=.${host}`]) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
    }
  }
}

/** The visitor's current choice, kept in sync across components and tabs. */
export function useConsent(): [Consent, boolean] {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const update = () => setConsent(readConsent());
    update();
    setReady(true);
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return [consent, ready];
}

/** The banner, shown until the visitor chooses. */
export function ConsentBanner() {
  const [consent, ready] = useConsent();
  if (!ready || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie choices"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-slate-900/10 bg-white p-5 text-slate-900 shadow-2xl sm:inset-x-6"
    >
      <p className="text-sm font-semibold">Cookies on SyncPads</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        We use one essential cookie to keep you signed in. With your permission, we also use Microsoft Clarity on our public
        pages (like this one) to see how visitors use them, so we can improve them. Clarity never runs inside your workspace.{" "}
        <Link href="/privacy#cookies" className="font-medium text-slate-900 underline decoration-sync-500 underline-offset-2">
          Learn more
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => writeConsent("declined")}>
          Decline
        </button>
        <button type="button" className="btn-primary" onClick={() => writeConsent("accepted")}>
          Accept
        </button>
      </div>
    </div>
  );
}

/** "Cookie settings": forget the choice so the banner asks again. */
export function CookieSettingsLink({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const was = readConsent();
        writeConsent(null);
        clearAnalyticsCookies();
        // Analytics may already be running on this page: reload to stop it.
        if (was === "accepted") window.location.reload();
      }}
    >
      Cookie settings
    </button>
  );
}

/** Called when a visitor declines after Clarity had loaded on this page. */
export function useStopAnalyticsOnDecline(consent: Consent) {
  const [hadAccepted, setHadAccepted] = useState(false);
  useEffect(() => {
    if (consent === "accepted") setHadAccepted(true);
    if (consent === "declined") {
      clearAnalyticsCookies();
      if (hadAccepted) window.location.reload();
    }
  }, [consent, hadAccepted]);
}
