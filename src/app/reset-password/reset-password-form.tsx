"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== String(form.get("confirm"))) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword, token });
    setLoading(false);
    if (error) setError(error.message ?? "This reset link is invalid or has expired.");
    else setDone(true);
  }

  if (done) {
    return (
      <>
        <Alert kind="success">Your password has been reset. You&apos;ve been signed out everywhere.</Alert>
        <Link href="/login" className="btn-primary w-full py-2.5">
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={onSubmit}>
        <Field
          hint="At least 8 characters"
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
        <Field
          label="Confirm new password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </>
  );
}

