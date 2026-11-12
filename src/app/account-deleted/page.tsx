import Link from "next/link";
import { AuthCard } from "@/components/ui";

export default function AccountDeletedPage() {
  return (
    <AuthCard title="Account deleted" footer={<Link href="/signup">Create a new account</Link>}>
      <p className="text-sm text-zinc-700">
        Your account and all of your data have been deleted, and you&apos;ve been signed out on
        every device.
      </p>
    </AuthCard>
  );
}

