"use client";

import Link from "next/link";
import { useState } from "react";
import { IconArrowLeft, IconMail } from "@/components/icons";
import { Alert, AuthCard, Button, Field, StatusIcon, linkClass } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

const backToSignIn = (
  <Link href="/login" className={`inline-flex items-center gap-1.5 ${linkClass}`}>
    <IconArrowLeft size={14} />
    Back to sign in
  </Link>
);

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const email = String(new FormData(e.currentTarget).get("email"));
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setLoading(false);
    if (error) setError(error.message ?? "Something went wrong. Try again.");
    else setSentTo(email);
  }

  if (sentTo) {
    // Same message whether or not the account exists.
    return (
      <AuthCard
        icon={
          <StatusIcon tone="brand">
            <IconMail size={22} />
          </StatusIcon>
        }
        title="Check your email"
        subtitle={
          <>
            If an account exists for <strong className="text-slate-900">{sentTo}</strong>, we&apos;ve sent a link to
            reset your password. It expires in 1 hour.
          </>
        }
        footer={backToSignIn}
      >
        <button type="button" className="btn-secondary w-full py-2.5" onClick={() => setSentTo(null)}>
          Try a different email
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to choose a new password."
      footer={backToSignIn}
    >
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={onSubmit}>
        <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}
