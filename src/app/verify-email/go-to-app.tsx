"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Short progress bar, then on to the workspace (or `to`, such as back to a shared page). */
export function GoToApp({ to = "/app" }: { to?: string }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(to), 1800);
    return () => clearTimeout(t);
  }, [router, to]);

  return (
    <>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-full origin-left animate-[grow_1.8s_ease-out_forwards] rounded-full bg-sync-500" />
      </div>
      <style>{"@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}"}</style>
      <Link href={to} className="btn-primary mt-6 w-full py-2.5">
        {to.startsWith("/s/") ? "Back to the shared page" : "Open my workspace"}
      </Link>
    </>
  );
}
