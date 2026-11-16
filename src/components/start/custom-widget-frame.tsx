"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_CUSTOM_DATA } from "@/lib/widgets";

/**
 * Runs a custom widget's code in a locked-down iframe:
 *  - sandbox="allow-scripts" without allow-same-origin: an opaque origin, so the
 *    code can't read SyncPads, the session, cookies or storage, or reach the page.
 *  - no allow-forms, allow-top-navigation or allow-modals: no form posts, no
 *    redirecting the page, no alert/prompt dialogs. Links may open new tabs.
 *  - a Content-Security-Policy inside the frame: inline code only (no external
 *    scripts or styles), images and fetch over HTTPS only.
 * The frame talks to the page only through postMessage: its height, and the
 * data it saves with syncpads.save() (ignored when read only).
 */
export function CustomWidgetFrame({
  html,
  data,
  onSave,
  title,
  maxHeight = 520,
}: {
  html: string;
  data?: unknown;
  /** Omit for read only (share links, previews): saves are ignored. */
  onSave?: (data: unknown) => void;
  title: string;
  maxHeight?: number;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(120);
  const [dark, setDark] = useState(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Follow the surrounding theme: a .dark ancestor, or a "system" share page on a dark device.
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(Boolean(holder.closest(".dark")) || (Boolean(holder.closest(".theme-system")) && mq.matches));
    update();
    mq.addEventListener("change", update);
    const observer = new MutationObserver(update);
    let el: HTMLElement | null = holder.parentElement;
    while (el) {
      observer.observe(el, { attributes: true, attributeFilter: ["class"] });
      el = el.parentElement;
    }
    return () => {
      mq.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  // The latest data, so a rebuild (theme change) starts from what was last saved.
  const latestData = useRef(data);
  latestData.current = data;
  // Rebuilt only when the code or the theme changes, so saving doesn't reload the widget.
  const srcDoc = useMemo(() => buildDocument(html, latestData.current ?? null, dark), [html, dark]);

  useEffect(() => {
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return; // only this widget's frame
      const msg = e.data as { type?: string; height?: number; data?: unknown };
      if (msg?.type === "sp:height" && typeof msg.height === "number") {
        setHeight(Math.min(maxHeight, Math.max(40, Math.ceil(msg.height))));
      } else if (msg?.type === "sp:save" && onSaveRef.current) {
        let size = Infinity;
        try {
          size = JSON.stringify(msg.data ?? null).length;
        } catch {}
        if (size > MAX_CUSTOM_DATA) return;
        clearTimeout(saveTimer);
        const value = msg.data;
        latestData.current = value;
        saveTimer = setTimeout(() => onSaveRef.current?.(value), 600);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(saveTimer);
    };
  }, [maxHeight]);

  return (
    <div ref={holderRef}>
      <iframe
        ref={frameRef}
        title={title}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        className="block w-full border-0 bg-transparent"
        style={{ height, colorScheme: dark ? "dark" : "light" }}
      />
    </div>
  );
}

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; media-src https: data:; font-src data:; connect-src https:; form-action 'none'; base-uri 'none'";

/** Escapes JSON for safe use inside a <script> element. */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

function buildDocument(html: string, data: unknown, dark: boolean) {
  const vars = dark
    ? "--sp-text:#e2e8f0;--sp-muted:#94a3b8;--sp-border:rgba(255,255,255,.12);--sp-surface:rgba(255,255,255,.06);--sp-accent:#fa4616;--sp-accent-text:#fff;"
    : "--sp-text:#0b1f44;--sp-muted:#64748b;--sp-border:rgba(11,31,68,.12);--sp-surface:rgba(11,31,68,.04);--sp-accent:#d93a0e;--sp-accent-text:#fff;";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{${vars}--sp-radius:8px;color-scheme:${dark ? "dark" : "light"}}
html,body{margin:0;padding:0;background:transparent}
body{color:var(--sp-text);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}
*{box-sizing:border-box}
button{font:inherit}
</style>
<script>
(function(){
  var data = ${scriptJson(data)};
  window.syncpads = {
    load: function(){ return Promise.resolve(data); },
    save: function(value){ data = value; parent.postMessage({ type: "sp:save", data: value }, "*"); },
    theme: ${JSON.stringify(dark ? "dark" : "light")}
  };
  function report(){ parent.postMessage({ type: "sp:height", height: document.documentElement.scrollHeight }, "*"); }
  window.addEventListener("load", report);
  if (window.ResizeObserver) new ResizeObserver(report).observe(document.documentElement);
  setTimeout(report, 50);
})();
</script>
</head><body>${html}</body></html>`;
}
