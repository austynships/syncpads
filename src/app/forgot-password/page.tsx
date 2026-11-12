"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, AuthCard, Button, Field } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reset-password",
    });
    setLoading(false);
    if (error) setError(error.message ?? "Something went wrong. Try again.");
    else setSent(true);
  }

  return (
    <AuthCard title="Reset your password" footer={<Link href="/login">Back to sign in</Link>}>
      {sent ? (
        // Same message whether or not the account exists.
        <Alert kind="success">
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </Alert>
      ) : (
        <>
          {error && <Alert kind="error">{error}</Alert>}
          <form onSubmit={onSubmit}>
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            <Button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </>
      )}
    </AuthCard>
  );
}

