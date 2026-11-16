"use client";

import { useEffect, useRef } from "react";
import { IconX } from "@/components/icons";

/**
 * A large window over the start page, for things like Account settings and
 * Agents: full screen on phones, centered on wider screens. Closes on Escape,
 * the close button, or a click outside.
 */
export function AppModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Keep the page behind from scrolling while the window is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-slate-950/40 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col bg-slate-50 shadow-2xl outline-none sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl dark:bg-slate-950 dark:ring-1 dark:ring-white/10"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-900/[0.07] bg-white px-5 py-4 sm:rounded-t-2xl sm:px-6 dark:border-white/10 dark:bg-slate-900">
          <div className="min-w-0">
            <h2 id="app-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn -mr-1 shrink-0" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
