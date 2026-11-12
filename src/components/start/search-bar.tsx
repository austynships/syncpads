"use client";

import { useEffect, useRef, useState } from "react";
import { IconNote } from "@/components/icons";
import type { SearchResult } from "@/server/search";
import { api } from "./api";
import { Favicon } from "./favicon";

type Props = {
  /** Called when a note result is chosen: show its page. */
  onOpenPage: (pageId: string) => void;
};

/**
 * Search bar (SP-14). Ctrl/⌘+K or "/" focuses it. Results come from
 * /api/search: keyword matches, plus matches by meaning when smart features are on.
 */
export function SearchBar({ onOpenPage }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  // Keyboard shortcut to focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      try {
        const data = await api<{ results: SearchResult[] }>("GET", `/api/search?q=${encodeURIComponent(q)}&limit=8`);
        if (id === requestId.current) {
          setResults(data.results);
          setActive(0);
        }
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  function choose(r: SearchResult) {
    setOpen(false);
    if (r.type === "link" && r.url) {
      window.location.href = r.url;
    } else {
      onOpenPage(r.pageId);
      setQuery("");
      inputRef.current?.blur();
    }
  }

  const showPanel = open && query.trim().length > 0;

  return (
    <div className="relative hidden w-72 md:block lg:w-80">
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search your links"
        aria-label="Search your links and notes"
        aria-expanded={showPanel}
        aria-controls="search-results"
        role="combobox"
        className="field h-9 py-1.5 pl-9 pr-12"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") {
            setQuery("");
            inputRef.current?.blur();
          }
        }}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" />
      </svg>
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-300 px-1.5 text-[10px] font-medium text-slate-400 dark:border-slate-700">
        Ctrl K
      </kbd>

      {showPanel && (
        <div
          id="search-results"
          role="listbox"
          className="absolute right-0 top-11 z-40 w-[28rem] max-w-[90vw] overflow-hidden rounded-2xl border border-slate-900/[0.08] bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        >
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
              {loading ? "Searching…" : "No matches. Try different words."}
            </p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                className={`flex w-full gap-3 rounded-xl px-3 py-2.5 text-left ${
                  i === active ? "bg-slate-100 dark:bg-white/10" : ""
                }`}
              >
                <span className="mt-0.5">
                  {r.type === "link" ? <Favicon url={r.url} /> : <IconNote className="text-slate-500" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{r.title}</span>
                    {r.matchedBy.length === 1 && r.matchedBy[0] === "meaning" && (
                      <span className="shrink-0 rounded-full bg-sync-50 px-1.5 py-px text-[10px] font-semibold text-sync-700 dark:bg-sync-500/15 dark:text-sync-300">
                        Related
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {r.pageName} › {r.groupName}
                  </span>
                  {(r.summary || r.snippet) && (
                    <span className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{r.summary ?? r.snippet}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
