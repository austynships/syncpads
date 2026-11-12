"use client";

import Link from "next/link";
import { useState } from "react";
import { Clarity } from "@/components/clarity";
import { Alert, AuthCard, Button, Field, linkClass } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

/**
 * Where to go after signing in: ?next= (e.g. back to an agent's consent
 * screen), but only a path on this site, never another domain.
 */
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/app";
}

export default function LoginPage() {
  const [error, setError] = useState<{ kind: "error" | "warning"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL: "/verify-email", // for the verification email re-sent to unverified users
    });
    setLoading(false);

    if (!error) {
      // Full page load, so Clarity (public pages only) doesn't follow into the app.
      window.location.assign(nextPath());
      return;
    }
    if (error.status === 429) {
      setError({ kind: "warning", text: error.message ?? "Too many attempts. Try again later." });
    } else if (error.status === 403) {
      setError({ kind: "warning", text: "Please verify your email first. We've sent you a new link." });
    } else {
      // Same message for unknown email and wrong password.
      setError({ kind: "error", text: "Email or password is incorrect." });
    }
  }

  return (
    <>
    <Clarity />
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your SyncPads workspace."
      footer={
        <>
          New to SyncPads?{" "}
          <Link href="/signup" className={linkClass}>
            Create your workspace
          </Link>
        </>
      }
    >
      {error && <Alert kind={error.kind}>{error.text}</Alert>}
      <form onSubmit={onSubmit}>
        <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        <div className="relative">
          <Link
            href="/forgot-password"
            className="absolute right-0 top-0 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Forgot password?
          </Link>
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
    </>
  );
}
