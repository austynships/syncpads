"use client";

import { useCallback, useEffect, useState } from "react";
import { IconBot, IconCheck, IconCopy, IconEyeOff, IconUndo } from "@/components/icons";
import { api } from "@/components/start/api";

type Agent = {
  id: string;
  name: string;
  client: "claude" | "chatgpt" | "cursor" | "other";
  permission: "read" | "read_add" | "read_add_context";
  autoApprove: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  pageIds: string[] | null;
};
type Page = { id: string; name: string; hiddenFromAgents: boolean };
type Entry = {
  id: string;
  action: string;
  agentName: string | null;
  after: {
    query?: string;
    topic?: string | null;
    results?: number;
    page?: string;
    url?: string;
    title?: string | null;
    status?: string;
    secretsRemoved?: number;
  } | null;
  reason: string | null;
  createdAt: string;
  undoneAt: string | null;
  itemTitle: string | null;
  itemUrl: string | null;
  canUndo: boolean;
};

const CLIENTS = [
  {
    id: "claude",
    label: "Claude",
    steps: [
      "In Claude, open Settings → Connectors and choose Add custom connector.",
      "Name it SyncPads and paste the address above.",
      "Claude opens SyncPads: sign in, choose what it may do, and click Allow.",
    ],
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    steps: [
      "In ChatGPT, open Settings → Connectors and add a custom connector (you may need to turn on developer mode first).",
      "Paste the address above and choose OAuth as the authentication.",
      "ChatGPT opens SyncPads: sign in, choose what it may do, and click Allow.",
    ],
  },
  {
    id: "cursor",
    label: "Cursor",
    steps: [
      "In Cursor, open Settings → MCP and add a new MCP server, or add this to your mcp.json:",
      'CODE:{ "mcpServers": { "syncpads": { "url": "MCP_URL" } } }',
      "Cursor opens SyncPads in your browser: sign in and click Allow.",
    ],
  },
  {
    id: "other",
    label: "Other",
    steps: [
      "Any app that supports remote MCP servers with OAuth can connect.",
      "Add a remote (Streamable HTTP) MCP server with the address above. The app registers itself and opens SyncPads for you to allow it.",
    ],
  },
] as const;

const ACTION_LABEL: Record<string, string> = {
  add_link: "Added a link",
  save_context: "Saved context",
  get_context: "Read your context",
  search: "Searched",
  get_page: "Read a page",
  list_pages: "Listed your pages",
};

export function AgentsView() {
  const [data, setData] = useState<{
    mcpUrl: string;
    plan: "free" | "pro";
    contextProfile: string;
    agents: Agent[];
    pages: Page[];
  } | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showReads, setShowReads] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, log] = await Promise.all([
        api<{ mcpUrl: string; plan: "free" | "pro"; contextProfile: string; agents: Agent[]; pages: Page[] }>("GET", "/api/agents"),
        api<{ entries: Entry[] }>("GET", "/api/activity"),
      ]);
      setData(a);
      setEntries(log.entries);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    }
    await load();
  }

  if (!data) {
    return <p className="mt-10 text-sm text-slate-500">{error ?? "Loading…"}</p>;
  }

  const visibleEntries = showReads ? entries : entries.filter((e) => e.action === "add_link" || e.action === "save_context");

  return (
    <div className="mt-8 space-y-8">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {data.plan === "free" && (
        <p className="rounded-2xl border border-sync-200 bg-sync-50 px-5 py-4 text-sm text-slate-800">
          <strong>You&apos;re on SyncPads Free:</strong> 1 connected agent, which can search and read your pages. With Pro, connect
          as many as you like and let them add links and save context from your conversations.{" "}
          <a href="/pricing" className="font-semibold text-slate-900 underline decoration-sync-500 underline-offset-2">
            See Pro
          </a>
        </p>
      )}

      <ConnectCard mcpUrl={data.mcpUrl} />

      <HowIWorkCard initial={data.contextProfile} onSave={(text) => run(() => api("PATCH", "/api/settings", { contextProfile: text || null }))} />

      <section>
        <h2 className="text-lg font-bold text-slate-900">Connected agents</h2>
        {data.agents.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
            No agents yet. Connect one with the steps above.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {data.agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                pages={data.pages}
                onChange={(patch) => run(() => api("PATCH", `/api/agents/${agent.id}`, patch))}
                onRevoke={() => {
                  if (confirm(`Disconnect ${agent.name}? It loses access right away. Its activity stays in the log.`)) {
                    run(() => api("DELETE", `/api/agents/${agent.id}`));
                  }
                }}
              />
            ))}
          </div>
        )}
        {data.pages.some((p) => p.hiddenFromAgents) && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <IconEyeOff size={14} />
            Hidden from every agent: {data.pages.filter((p) => p.hiddenFromAgents).map((p) => p.name).join(", ")}. Change this in
            each page&apos;s settings.
          </p>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Activity</h2>
            <p className="text-sm text-slate-600">Everything your agents did. Links they added can be undone for 30 days.</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showReads} onChange={(e) => setShowReads(e.target.checked)} className="accent-sync-600" />
            Show searches and reads
          </label>
        </div>
        <ul className="mt-3 divide-y divide-slate-900/[0.06] overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white">
          {visibleEntries.length === 0 && <li className="px-5 py-6 text-sm text-slate-500">Nothing yet.</li>}
          {visibleEntries.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <IconBot size={15} />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-slate-900">
                  <span className="font-semibold">{e.agentName ?? "Disconnected agent"}</span> · {ACTION_LABEL[e.action] ?? e.action}
                  {e.action === "search" && e.after?.query ? `: "${e.after.query}"` : ""}
                  {e.action === "get_page" && e.after?.page ? `: ${e.after.page}` : ""}
                </p>
                {(e.action === "add_link" || e.action === "save_context") && (
                  <p className="truncate text-slate-600">
                    {e.itemTitle || e.after?.title || e.itemUrl || e.after?.url}
                    {e.after?.status === "inbox" && !e.undoneAt ? " · sent to your inbox" : ""}
                    {e.after?.secretsRemoved ? ` · ${e.after.secretsRemoved} possible secret${e.after.secretsRemoved === 1 ? "" : "s"} removed` : ""}
                  </p>
                )}
                {e.action === "get_context" && e.after?.topic && <p className="truncate text-slate-600">Topic: {e.after.topic}</p>}
                {e.reason && <p className="mt-0.5 text-xs text-slate-500">&ldquo;{e.reason}&rdquo;</p>}
                <p className="mt-0.5 text-xs text-slate-400">
                  {new Date(e.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  {e.undoneAt ? " · undone" : ""}
                </p>
              </div>
              {e.canUndo && (
                <button type="button" className="btn-ghost shrink-0 text-xs" onClick={() => run(() => api("POST", `/api/activity/${e.id}/undo`))}>
                  <IconUndo size={14} />
                  Undo
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** "How I work": standing context every connected agent reads first (get_context). */
function HowIWorkCard({ initial, onSave }: { initial: string; onSave: (text: string) => void }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  const changed = text !== initial;

  return (
    <section className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">How I work</h2>
      <p className="mt-1 text-sm text-slate-600">
        Tell every AI you connect how you like to work. They read this first, before anything else in SyncPads. Don&apos;t
        include passwords or keys.
      </p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={7}
        maxLength={10_000}
        placeholder={"I'm a freelance designer. Clients: Acme (weekly reports, Fridays) and Globex.\nWe use Figma for design and Linear for tasks.\nKeep answers short. Use British spelling."}
        className="field mt-4 resize-y font-normal leading-relaxed"
        aria-label="How I work"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">{text.length.toLocaleString()} / 10,000</span>
        <button
          type="button"
          className="btn-primary"
          disabled={!changed && !saved}
          onClick={() => {
            onSave(text.trim());
            setSaved(true);
          }}
        >
          {saved && !changed ? <IconCheck size={15} /> : null}
          {saved && !changed ? "Saved" : "Save"}
        </button>
      </div>
    </section>
  );
}

function ConnectCard({ mcpUrl }: { mcpUrl: string }) {
  const [tab, setTab] = useState<(typeof CLIENTS)[number]["id"]>("claude");
  const [copied, setCopied] = useState(false);
  const client = CLIENTS.find((c) => c.id === tab)!;

  return (
    <section className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Connect an agent</h2>
      <p className="mt-1 text-sm text-slate-600">Add SyncPads to your AI app with this address:</p>
      <div className="mt-3 flex gap-2">
        <code className="flex-1 truncate rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900">{mcpUrl}</code>
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={async () => {
            await navigator.clipboard.writeText(mcpUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-5 flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
        {CLIENTS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={tab === c.id}
            onClick={() => setTab(c.id)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
              tab === c.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
        Once connected, ask your AI to &ldquo;check SyncPads&rdquo; for anything you&apos;ve saved, or say{" "}
        <strong>&ldquo;save this to SyncPads&rdquo;</strong> to keep a conversation&apos;s decisions and links for every AI you use.
      </p>
      <ol className="mt-4 space-y-2 text-sm text-slate-700">
        {client.steps.map((step, i) =>
          step.startsWith("CODE:") ? (
            <li key={i}>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
                {step.slice(5).replace("MCP_URL", mcpUrl)}
              </pre>
            </li>
          ) : (
            <li key={i} className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sync-50 text-[11px] font-bold text-sync-700">
                {client.steps.slice(0, i + 1).filter((s) => !s.startsWith("CODE:")).length}
              </span>
              {step}
            </li>
          ),
        )}
      </ol>
    </section>
  );
}

function AgentCard({
  agent,
  pages,
  onChange,
  onRevoke,
}: {
  agent: Agent;
  pages: Page[];
  onChange: (patch: Partial<Pick<Agent, "permission" | "autoApprove" | "pageIds">>) => void;
  onRevoke: () => void;
}) {
  const allPages = agent.pageIds === null;
  const selectable = pages.filter((p) => !p.hiddenFromAgents);

  return (
    <article className="rounded-2xl border border-slate-900/[0.07] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <IconBot size={20} />
          </span>
          <div>
            <h3 className="font-semibold text-slate-900">{agent.name}</h3>
            <p className="text-xs text-slate-500">
              {agent.lastUsedAt
                ? `Last used ${new Date(agent.lastUsedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                : "Not used yet"}
            </p>
          </div>
        </div>
        <button type="button" className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onRevoke}>
          Disconnect
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-800">Access</span>
          <select
            value={agent.permission}
            onChange={(e) => onChange({ permission: e.target.value as Agent["permission"] })}
            className="field"
          >
            <option value="read_add_context">Read, add links and save context</option>
            <option value="read_add">Read and add links</option>
            <option value="read">Read only</option>
          </select>
        </label>
        <label className="flex items-start gap-2.5 pt-6 text-sm">
          <input
            type="checkbox"
            checked={agent.autoApprove}
            disabled={agent.permission === "read"}
            onChange={(e) => onChange({ autoApprove: e.target.checked })}
            className="mt-0.5 accent-sync-600"
          />
          <span>
            <span className="block font-medium text-slate-800">Skip the inbox</span>
            <span className="block text-xs text-slate-500">Links and context it adds go straight onto your page.</span>
          </span>
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-1.5 text-sm font-medium text-slate-800">Pages it can see</legend>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            checked={allPages}
            onChange={() => onChange({ pageIds: null })}
            className="accent-sync-600"
          />
          All pages (except hidden ones)
        </label>
        <label className="mt-1 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            checked={!allPages}
            onChange={() => onChange({ pageIds: selectable.slice(0, 1).map((p) => p.id) })}
            className="accent-sync-600"
          />
          Only these pages:
        </label>
        {!allPages && (
          <div className="mt-2 flex flex-wrap gap-2 pl-6">
            {selectable.map((p) => {
              const on = agent.pageIds!.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onChange({ pageIds: on ? agent.pageIds!.filter((id) => id !== p.id) : [...agent.pageIds!, p.id] })
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>
    </article>
  );
}
