import { listForReview } from "@/server/custom-widgets";
import { requireAdmin } from "../guard";
import { PageHeader, Section, date, num } from "../ui";
import { ReviewCard } from "./review-card";

export const metadata = { title: "Widget gallery" };

export default async function GalleryAdminPage() {
  await requireAdmin();
  const all = await listForReview();
  const pending = all.filter((w) => w.status === "pending");
  const published = all.filter((w) => w.status === "published");
  const closed = all.filter((w) => w.status === "rejected" || w.status === "removed");

  return (
    <>
      <PageHeader
        title="Widget gallery"
        intro="Widgets people built with AI and want to share. Nothing is listed until you approve it; widgets with 3 reports come back here."
      />

      <Section title={`Waiting for review (${num(pending.length)})`}>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 text-sm text-slate-500 shadow-sm">Nothing to review.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((w) => (
              <ReviewCard key={w.id} widget={{ ...w, createdAt: date(w.createdAt) }} actions={["publish", "reject"]} />
            ))}
          </div>
        )}
      </Section>

      <Section title={`In the gallery (${num(published.length)})`}>
        {published.length === 0 ? (
          <p className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 text-sm text-slate-500 shadow-sm">No published widgets yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {published.map((w) => (
              <ReviewCard key={w.id} widget={{ ...w, createdAt: date(w.createdAt) }} actions={["remove"]} />
            ))}
          </div>
        )}
      </Section>

      {closed.length > 0 && (
        <Section title="Rejected and removed">
          <div className="grid gap-4 lg:grid-cols-2">
            {closed.map((w) => (
              <ReviewCard key={w.id} widget={{ ...w, createdAt: date(w.createdAt) }} actions={["publish"]} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
