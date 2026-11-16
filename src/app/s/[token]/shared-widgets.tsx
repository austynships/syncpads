"use client";

import { WidgetView, widgetTitle } from "@/components/start/widgets";
import type { WidgetDTO } from "@/lib/widgets";

/** The page's widgets on a share link: read only, live data loaded through the link. */
export function SharedWidgets({ token, widgets }: { token: string; widgets: WidgetDTO[] }) {
  if (widgets.length === 0) return null;
  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] items-start gap-4">
      {widgets.map((w) => (
        <section key={w.id} className="card p-3.5">
          <h2 className="mb-2 truncate px-1 text-sm font-semibold text-slate-900 dark:text-white">{widgetTitle(w)}</h2>
          <WidgetView widget={w} dataUrl={`/api/shared/${encodeURIComponent(token)}/widgets/${encodeURIComponent(w.id)}`} />
        </section>
      ))}
    </div>
  );
}
