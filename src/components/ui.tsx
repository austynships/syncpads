/** Shared UI for the sign-in, sign-up, password and account pages. */
import { Logo } from "@/components/brand";
import { IconAlert, IconCheck } from "@/components/icons";

const points = [
  "Your links, tools and notes on one page",
  "Organized into pages and groups your way",
  "Synced to every device you sign in on",
];

/**
 * Two-panel auth layout: a navy brand panel (desktop only) and the form.
 * `icon` shows a badge above the title for status screens (check your email, done, expired).
 */
export function AuthCard({
  title,
  subtitle,
  icon,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-slate-950 p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_0%_0%,rgb(30_64_175/0.45),transparent_70%),radial-gradient(50%_40%_at_100%_100%,rgb(250_70_22/0.18),transparent_70%)]"
        />
        <Logo tone="dark" height={32} href="/" className="relative" />
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight tracking-tight">Your Personalized Workspace.</h2>
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-sync-400">
                  <IconCheck size={14} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-slate-400">Organize. Access. Get More Done.</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <Logo height={30} href="/" className="mb-10 lg:hidden" />
          {icon && <div className="mb-5">{icon}</div>}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-8 text-sm text-slate-600">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/** Round badge for status screens. */
export function StatusIcon({ tone, children }: { tone: "brand" | "success" | "warning"; children: React.ReactNode }) {
  const styles = {
    brand: "bg-sync-50 text-sync-600 ring-sync-100",
    success: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    warning: "bg-amber-50 text-amber-600 ring-amber-100",
  };
  return (
    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-4 ${styles[tone]}`}>{children}</span>
  );
}

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium text-slate-800">{label}</span>
      <input {...props} className="field py-2.5" />
      {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Button({
  variant = "primary",
  ...props
}: { variant?: "primary" | "danger" | "secondary" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger:
      "inline-flex items-center justify-center rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/30 disabled:opacity-50",
  };
  return <button {...props} className={`${styles[variant]} w-full py-2.5 ${props.className ?? ""}`} />;
}

export function Alert({ kind, children }: { kind: "error" | "success" | "warning"; children: React.ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return (
    <p role="alert" className={`mb-4 flex gap-2 rounded-lg border px-3 py-2.5 text-sm ${styles[kind]}`}>
      {kind === "success" ? <IconCheck className="mt-0.5" /> : <IconAlert className="mt-0.5" />}
      <span>{children}</span>
    </p>
  );
}

/** Inline text link in brand style. */
export const linkClass = "font-semibold text-slate-900 underline decoration-sync-500 decoration-2 underline-offset-4 hover:decoration-sync-600";
