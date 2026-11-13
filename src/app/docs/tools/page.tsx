import Link from "next/link";
import { Callout, CodeBlock, DocTitle, H2, NextPage, PlanBadge, Prompt, Prose } from "@/components/docs";

export const metadata = { title: "Tools reference" };

type Param = { name: string; type: string; required?: boolean; desc: string };

function Params({ params }: { params: Param[] }) {
  if (params.length === 0) return <p className="text-sm text-slate-500">No inputs.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-900/[0.08] bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-900">
          <tr>
            <th className="px-4 py-2 font-semibold">Input</th>
            <th className="px-4 py-2 font-semibold">Type</th>
            <th className="px-4 py-2 font-semibold">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-900/[0.06] text-slate-700">
          {params.map((p) => (
            <tr key={p.name} className="align-top">
              <td className="whitespace-nowrap px-4 py-2 font-mono text-[13px] text-slate-900">
                {p.name}
                {p.required && <span className="text-sync-600">*</span>}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-slate-500">{p.type}</td>
              <td className="px-4 py-2">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tool({
  id,
  plan,
  summary,
  params,
  returns,
  prompts,
  children,
}: {
  id: string;
  plan: "free" | "pro";
  summary: React.ReactNode;
  params: Param[];
  returns: React.ReactNode;
  prompts: string[];
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-slate-900/[0.07] pt-10 first-of-type:mt-6 first-of-type:border-0 first-of-type:pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <H2 id={id}>
          <code className="font-mono">{id}</code>
        </H2>
        <span className="-mt-0.5">
          <PlanBadge plan={plan} />
        </span>
      </div>
      <Prose>{summary}</Prose>
      <div className="mt-5">
        <Params params={params} />
      </div>
      <div className="mt-4">
        <Prose>
          <p>
            <strong>Returns:</strong> {returns}
          </p>
        </Prose>
      </div>
      {children && <div className="mt-4">{children}</div>}
      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Try asking</p>
      <div className="space-y-2">
        {prompts.map((p) => (
          <Prompt key={p}>&ldquo;{p}&rdquo;</Prompt>
        ))}
      </div>
    </section>
  );
}

export default function ToolsPage() {
  return (
    <>
      <DocTitle
        eyebrow="Reference"
        title="Tools reference"
        intro={
          <p>
            SyncPads gives your AI six tools. You don&apos;t call them yourself: ask in plain words and your AI picks the right
            one. This page shows what each does, so you know what to ask for.
          </p>
        }
      />

      <Callout title="Everything saved is treated as data, not instructions">
        Results that include saved page text, titles, summaries or notes start with a notice telling the AI to treat them as
        untrusted data. Text on a web page you saved can&apos;t instruct your AI to do something.
      </Callout>

      <Tool
        id="get_context"
        plan="free"
        summary={
          <p>
            The starting point. SyncPads tells every AI to call it first when a task is about your work. It returns your{" "}
            <Link href="/docs/guides#how-i-work">How I work</Link> notes, the pages the AI can see, the most recently saved
            context, and, if it gives a topic, the links and notes most relevant to it.
          </p>
        }
        params={[{ name: "topic", type: "text", desc: "What the task is about, such as \"Acme redesign\" or \"our API\". Optional." }]}
        returns={
          <>
            your How I work notes (marked as written by you), visible pages with their ids, the 5 most recent notes saved by
            AIs, and up to 8 relevant links and notes for the topic.
          </>
        }
        prompts={["Before we start, check SyncPads for context on the Acme project.", "What do you know about how I work?"]}
      />

      <Tool
        id="search"
        plan="free"
        summary={
          <p>
            Searches your saved links and notes. Keyword search covers titles, addresses, tags, summaries, notes and the text
            of saved pages. On Pro with smart features on, it also finds links by meaning, so &ldquo;video hosting&rdquo; can
            find YouTube even though the words differ.
          </p>
        }
        params={[
          { name: "query", type: "text", required: true, desc: "What to look for, in plain words." },
          { name: "page_id", type: "text", desc: "Only search this page." },
          { name: "tag", type: "text", desc: "Only items with this tag." },
          { name: "limit", type: "number", desc: "Maximum results, 1 to 50 (default 10)." },
        ]}
        returns={<>each match&apos;s title, address, summary, tags, note text (for notes), page and group.</>}
        prompts={["Search my SyncPads for design tools.", "Do I have anything saved about invoicing?"]}
      />

      <Tool
        id="list_pages"
        plan="free"
        summary={<p>Lists the pages the AI can see, with how many groups and items each has. Hidden pages never appear.</p>}
        params={[]}
        returns={<>each visible page&apos;s id, name, and number of groups and items.</>}
        prompts={["What pages do I have in SyncPads?"]}
      />

      <Tool
        id="get_page"
        plan="free"
        summary={
          <p>
            Reads one page in full: its groups, links (with summaries and tags) and notes. Notes saved by an AI are labeled
            with which one saved them.
          </p>
        }
        params={[
          { name: "page_id", type: "text", required: true, desc: "The page id, from list_pages, search or get_context." },
          { name: "format", type: "json | markdown", desc: "Markdown gives a compact, readable outline. Default: json." },
        ]}
        returns={<>the page&apos;s name and groups, each with its links and notes.</>}
        prompts={["Read my Acme page in SyncPads and summarize where things stand.", "What's on my Work page?"]}
      >
        <CodeBlock title="Example (markdown)">{`# Acme

## Client
- [Acme brief](https://docs.example.com/acme-brief) — Goals, audience and timeline for the redesign.
- [Acme analytics](https://analytics.example.com/acme)

## Notes
- Note saved by Claude: Acme redesign: colors and fonts`}</CodeBlock>
      </Tool>

      <Tool
        id="add_link"
        plan="pro"
        summary={
          <p>
            Suggests a link for your start page. It goes to your <Link href="/docs/control#inbox">Agent Inbox</Link> with the
            AI&apos;s reason, unless you let that AI skip the inbox. Adding the same address twice does nothing.
          </p>
        }
        params={[
          { name: "url", type: "text", required: true, desc: "The full web address." },
          { name: "title", type: "text", desc: "A short title." },
          { name: "note", type: "text", desc: "Context for you, shown in the inbox." },
          { name: "page_id", type: "text", desc: "Which page it belongs on. Default: your first page." },
          { name: "reason", type: "text", desc: "Why it's adding it, shown in the inbox." },
        ]}
        returns={<>whether it went to the inbox or straight onto the page, or that it was already saved.</>}
        prompts={["Save the three best resources you found to my Research page in SyncPads.", "Add that documentation link to SyncPads."]}
      />

      <Tool
        id="save_context"
        plan="pro"
        summary={
          <p>
            Saves what matters from a conversation as a note: a title, a short summary, decisions, open questions and related
            links. It&apos;s a distilled note, never a transcript. Anything that looks like a password, API key, token or card
            number is removed before saving. Needs the &ldquo;Read, add links and save context&rdquo; level.
          </p>
        }
        params={[
          { name: "title", type: "text", required: true, desc: "A short title, such as \"Acme redesign: color decisions\"." },
          { name: "summary", type: "text", required: true, desc: "What was discussed and concluded, in a few sentences." },
          { name: "decisions", type: "list of text", desc: "Decisions made, one per item." },
          { name: "open_questions", type: "list of text", desc: "Questions still open." },
          { name: "links", type: "list of {url, title}", desc: "Links that came up and matter." },
          { name: "page_id", type: "text", desc: "Which page it belongs on. Default: your first page." },
          { name: "reason", type: "text", desc: "Why it's saving it, shown in the inbox." },
        ]}
        returns={<>whether it was saved to the inbox or the page, and how many possible secrets were removed.</>}
        prompts={[
          "Save this to SyncPads.",
          "Save our decisions about the pricing page to my Acme page in SyncPads.",
          "Remember the open questions from this chat in SyncPads.",
        ]}
      />

      <Callout tone="pro" title="Limits">
        Each AI can make 60 requests a minute, and 2,000 a day on Free or 10,000 a day on Pro. If it hits a limit, it gets a
        plain message saying when to try again.
      </Callout>

      <NextPage href="/docs/guides" title="Get the most out of it" />
    </>
  );
}
