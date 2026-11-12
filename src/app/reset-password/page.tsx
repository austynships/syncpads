import Link from "next/link";
import { Alert, AuthCard } from "@/components/ui";
import { ResetPasswordForm } from "./reset-password-form";

// The emailed link goes to /api/auth/reset-password/:token, which redirects
// here with ?token=... (or ?error=INVALID_TOKEN if it expired).
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <AuthCard title="Link expired" footer={<Link href="/login">Back to sign in</Link>}>
        <Alert kind="error">This reset link is invalid or has expired.</Alert>
        <Link href="/forgot-password" className="text-sm underline">
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}

