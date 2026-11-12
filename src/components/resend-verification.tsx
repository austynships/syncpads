"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

const COOLDOWN_SECONDS = 60;

/**
 * "Resend email" button with a 60-second cooldown. If `email` is not given,
 * it shows an email field (used on the expired-link screen).
 */
export function ResendVerification({ email, primary = false }: { email?: string; primary?: boolean }) {
  const [address, setAddress] = useState(email ?? "");
  const [wait, setWait] = useState(email ? COOLDOWN_SECONDS : 0); // a link was just sent
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!address || wait > 0) return;
    setStatus("sending");
    const { error } = await authClient.sendVerificationEmail({ email: address, callbackURL: "/verify-email" });
    setStatus(error ? "error" : "sent");
    if (!error) setWait(COOLDOWN_SECONDS);
  }

  return (
    <form onSubmit={send}>
      {!email && (
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium text-slate-800">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="you@example.com"
            className="field py-2.5"
          />
        </label>
      )}
      <button
        type="submit"
        disabled={status === "sending" || wait > 0}
        className={`${primary ? "btn-primary" : "btn-secondary"} w-full py-2.5`}
      >
        {status === "sending"
          ? "Sending…"
          : wait > 0
            ? `Resend email in ${wait}s`
            : primary
              ? "Send a new link"
              : "Resend email"}
      </button>
      {status === "sent" && <p className="mt-3 text-sm text-emerald-700">Sent. Check your inbox.</p>}
      {status === "error" && <p className="mt-3 text-sm text-red-700">Couldn&apos;t send the email. Try again in a minute.</p>}
    </form>
  );
}
