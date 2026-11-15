import Link from "next/link";
import { Callout, CodeBlock, DocTitle, H2, H3, NextPage, Prose } from "@/components/docs";

export const metadata = {
  title: "Import and export",
  description: "Bring your bookmarks into SyncPads, back up your pages, or move them to another account or browser.",
};

export default function ImportExportPage() {
  return (
    <>
      <DocTitle
        eyebrow="Your data"
        title="Import and export"
        intro={
          <p>
            Bring your bookmarks in from any browser, keep a backup of your pages, or move them to another account. Your
            pages are yours: you can take everything with you at any time, on any plan.
          </p>
        }
      />

      <Prose>
        <p>
          Both live in your start page&apos;s <strong>Settings</strong> (the sliders button in the top bar), under{" "}
          <strong>Import</strong> and <strong>Export</strong>.
        </p>
      </Prose>

      <H2 id="export">Export your pages</H2>
      <Prose>
        <ol>
          <li>
            Open <strong>Settings</strong> and scroll to <strong>Export</strong>.
          </li>
          <li>
            Choose <strong>All pages</strong>, or <strong>This page</strong> for just the page you have open.
          </li>
          <li>Pick a format. The file downloads straight away.</li>
        </ol>
      </Prose>

      <H3 id="formats">Which format to choose</H3>
      <div className="overflow-hidden rounded-xl border border-slate-900/[0.08] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-900">
            <tr>
              <th className="px-4 py-2 font-semibold" />
              <th className="px-4 py-2 font-semibold">SyncPads file (.json)</th>
              <th className="px-4 py-2 font-semibold">Browser bookmarks (.html)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/[0.06] text-slate-700">
            {[
              ["Best for", "Backups, and moving to another SyncPads account", "Using your links in Chrome, Edge, Firefox or Safari"],
              ["Pages and groups", "Yes, in the same order", "Pages become folders, groups become subfolders"],
              ["Links and titles", "Yes", "Yes"],
              ["Notes", "Yes, including notes your AI saved", "No (browsers can't store them)"],
              ["Layouts", "Columns, tiles or list", "No"],
              ["Hidden from AI agents", "Kept", "No"],
              ["Summaries and tags", "Included for reference", "No"],
            ].map(([label, json, html]) => (
              <tr key={label} className="align-top">
                <td className="px-4 py-2 font-medium text-slate-900">{label}</td>
                <td className="px-4 py-2">{json}</td>
                <td className="px-4 py-2">{html}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Prose>
        <p className="mt-4">
          Links waiting in your <Link href="/docs/control#inbox">Agent Inbox</Link> and anything in the trash aren&apos;t
          exported, only what&apos;s on your pages.
        </p>
      </Prose>

      <Callout title="Keep a backup">
        Download a SyncPads file now and then, especially before a big reorganization. Importing it later brings everything
        back exactly as it was, as new pages.
      </Callout>

      <H2 id="import">Import pages and bookmarks</H2>
      <Prose>
        <ol>
          <li>
            Open <strong>Settings</strong> and scroll to <strong>Import</strong>.
          </li>
          <li>
            Click <strong>Choose file…</strong> and pick a SyncPads file (.json) or a bookmark file (.html). SyncPads works
            out which one it is.
          </li>
          <li>
            Check the preview, such as &ldquo;Ready to import 120 links and 4 notes into 3 new pages and 9 groups&rdquo;, then
            click <strong>Import</strong>.
          </li>
        </ol>
        <p>
          Imports always arrive as <strong>new pages</strong> after your existing ones. Nothing you already have is changed or
          replaced, so it&apos;s safe to try. If you don&apos;t like the result, delete the new pages.
        </p>
      </Prose>

      <H3 id="from-browser">Bringing bookmarks from your browser</H3>
      <Prose>
        <p>First export your bookmarks as an HTML file from your browser:</p>
        <ul>
          <li>
            <strong>Chrome or Edge:</strong> open the bookmark manager (Ctrl+Shift+O, or Cmd+Shift+O on a Mac), click the
            three-dot menu and choose <strong>Export bookmarks</strong>.
          </li>
          <li>
            <strong>Firefox:</strong> open the Library (Ctrl+Shift+O), then <strong>Import and Backup</strong> →{" "}
            <strong>Export Bookmarks to HTML</strong>.
          </li>
          <li>
            <strong>Safari:</strong> <strong>File</strong> → <strong>Export</strong> → <strong>Bookmarks</strong>.
          </li>
          <li>
            <strong>start.me:</strong> export your pages as an HTML bookmark file from start.me&apos;s settings.
          </li>
        </ul>
        <p>Then import that file into SyncPads. Here&apos;s how folders turn into pages and groups:</p>
        <ul>
          <li>Each top-level folder becomes a page.</li>
          <li>Links directly inside it go into a group called &ldquo;Links&rdquo;.</li>
          <li>
            Each subfolder becomes a group. Deeper folders become their own groups, named by their path, such as
            &ldquo;Work / Clients&rdquo;.
          </li>
          <li>Loose links at the top level go onto a page called &ldquo;Imported&rdquo;.</li>
          <li>Empty folders, and entries that aren&apos;t web links (such as bookmarklets), are skipped.</li>
        </ul>
      </Prose>

      <H3 id="after-import">After an import</H3>
      <Prose>
        <ul>
          <li>
            With smart features on, imported links get fresh summaries and tags in the background, so your AI can find them
            by topic within a few minutes.
          </li>
          <li>
            Pages you&apos;d hidden from AI agents stay hidden when you import a SyncPads file. Pages from a browser bookmark
            file are visible to your AI; you can <Link href="/docs/control#hidden-pages">hide any page</Link> in Settings.
          </li>
          <li>Notes are cleaned on the way in: anything that could run code, such as scripts, is removed.</li>
        </ul>
      </Prose>

      <H2 id="limits">Limits</H2>
      <Prose>
        <ul>
          <li>
            One import can add up to 100 pages, 2,000 groups, 10,000 links and 2,000 notes, from a file of up to 50 MB.
            Bigger collections can be split across a few imports.
          </li>
          <li>
            On <strong>Free</strong>, your plan&apos;s limits still apply (3 pages and 500 links in total). If an import would
            go over, nothing is added and you&apos;ll see how to upgrade; you can also export just one page, or tidy up first.
            See <Link href="/docs/control#plans">Plans and limits</Link>.
          </li>
          <li>Exporting is never limited, on any plan.</li>
        </ul>
      </Prose>

      <H2 id="file-format">The SyncPads file format</H2>
      <Prose>
        <p>
          The SyncPads file is plain JSON, so you can open it in any text editor or use it in your own scripts. Pages contain
          groups, and groups contain links and notes in order. Notes are HTML.
        </p>
      </Prose>
      <CodeBlock title="syncpads-2026-11-15.json">{`{
  "format": "syncpads",
  "version": 1,
  "exportedAt": "2026-11-15T18:30:00.000Z",
  "pages": [
    {
      "name": "Acme",
      "layout": "3",
      "hiddenFromAgents": false,
      "groups": [
        {
          "name": "Client",
          "layout": "list",
          "items": [
            {
              "type": "link",
              "url": "https://docs.example.com/acme-brief",
              "title": "Acme brief",
              "summary": "Goals, audience and timeline for the redesign.",
              "tags": ["acme", "brief"]
            },
            {
              "type": "note",
              "title": "Acme redesign: colors and fonts",
              "body": "<p>Primary orange, Plus Jakarta Sans.</p>"
            }
          ]
        }
      ]
    }
  ]
}`}</CodeBlock>
      <Prose>
        <p className="mt-4">
          When importing, only <code>format</code>, <code>version</code> and <code>pages</code> are required, and each link
          needs a <code>url</code>. <code>summary</code> and <code>tags</code> are ignored on import, because SyncPads makes
          fresh ones.
        </p>
      </Prose>

      <NextPage href="/docs/sharing" title="Share a page" />
    </>
  );
}
