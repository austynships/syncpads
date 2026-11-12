"use client";

import { useState } from "react";
import { displayHost } from "@/lib/url";

const COLORS = ["bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-teal-500", "bg-orange-500"];

/** Site icon from our favicon cache, or the site's first letter if there is none. */
export function Favicon({ url, size = 16 }: { url: string | null; size?: number }) {
  const host = url ? displayHost(url) : "";
  const [failed, setFailed] = useState(false);
  let fullHost = "";
  try {
    fullHost = url ? new URL(url).hostname : "";
  } catch {}

  if (!fullHost || failed) {
    const letter = (host[0] ?? "?").toUpperCase();
    const color = COLORS[[...host].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded font-semibold text-white ${color}`}
        style={{ width: size, height: size, fontSize: size * 0.6 }}
        aria-hidden
      >
        {letter}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/favicon?host=${encodeURIComponent(fullHost)}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded dark:bg-zinc-100 dark:p-px"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}

