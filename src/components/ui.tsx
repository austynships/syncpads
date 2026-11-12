/** Small shared UI pieces for the auth pages. */
import Link from "next/link";

export function AuthCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-lg font-semibold">
          SyncPads
        </Link>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-xl font-semibold">{title}</h1>
          {children}
        </div>
        {footer && <div className="mt-4 text-center text-sm text-zinc-600">{footer}</div>}
      </div>
    </main>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        {...props}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
      />
    </label>
  );
}

export function Button({
  variant = "primary",
  ...props
}: { variant?: "primary" | "danger" | "secondary" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700",
    danger: "bg-red-600 text-white hover:bg-red-500",
    secondary: "border border-zinc-300 bg-white hover:bg-zinc-100",
  };
  return (
    <button
      {...props}
      className={`w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${styles[variant]} ${props.className ?? ""}`}
    />
  );
}

export function Alert({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  const styles =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-green-200 bg-green-50 text-green-800";
  return (
    <p role="alert" className={`mb-3 rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

