"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function DeleteAccountForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirm("Delete your account and all your data permanently?")) return;

    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    // With a password and no verification email configured, Better Auth
    // checks the password and deletes the user (and every session) immediately.
    const { error } = await authClient.deleteUser({ password: String(form.get("password")) });
    setLoading(false);

    if (error) {
      setError(error.status === 400 ? "Password is incorrect." : (error.message ?? "Could not delete account."));
      return;
    }
    router.push("/account-deleted");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <Alert kind="error">{error}</Alert>}
      <Field
        label="Current password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" variant="danger" disabled={loading}>
        {loading ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  );
}

