/* eslint-disable @next/next/no-img-element -- small static brand files in /public */
import Link from "next/link";

/**
 * SyncPads logo (brand guide §5). The wordmark artwork is used as-is; the
 * "-dark" file is the same artwork with "Sync" in white for dark surfaces.
 *  - tone="light": on light backgrounds
 *  - tone="dark": on navy backgrounds
 *  - tone="auto": follows the .dark class (start page theme)
 */
export function Logo({
  tone = "light",
  height = 28,
  href,
  className = "",
}: {
  tone?: "light" | "dark" | "auto";
  height?: number;
  href?: string;
  className?: string;
}) {
  const width = Math.round(height * (535 / 120)); // artwork aspect ratio
  const img = (src: string, extra = "") => (
    <img src={src} alt="SyncPads" width={width} height={height} className={`block ${extra}`} style={{ height, width: "auto" }} />
  );
  const content =
    tone === "auto" ? (
      <>
        {img("/brand/syncpads-logo.png", "dark:hidden")}
        {img("/brand/syncpads-logo-dark.png", "hidden dark:block")}
      </>
    ) : (
      img(tone === "dark" ? "/brand/syncpads-logo-dark.png" : "/brand/syncpads-logo.png")
    );

  return href ? (
    <Link href={href} className={`inline-flex shrink-0 ${className}`} aria-label="SyncPads home">
      {content}
    </Link>
  ) : (
    <span className={`inline-flex shrink-0 ${className}`}>{content}</span>
  );
}

/** The standalone S icon, for compact placements. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return <img src="/brand/syncpads-icon.png" alt="SyncPads" width={size} height={size} className={`shrink-0 ${className}`} />;
}
