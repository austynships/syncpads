import Link from "next/link";
import { Callout, CodeBlock, DocTitle, H2, H3, NextPage, Prompt, Prose } from "@/components/docs";

export const metadata = { title: "Get the most out of it" };

export default function GuidesPage() {
  return (
    <>
      <DocTitle
        eyebrow="Guides"
        title="Get the most out of SyncPads with your AI"
        intro={
          <p>
            Your AI is only as useful as the context it can find. A few minutes of setup makes the difference between an AI
            that guesses and one that knows where your work lives.
          </p>
        }
      />

      <H2 id="how-i-work">1. Write your How I work notes</H2>
      <Prose>
        <p>
          On the <a href="/agents">Agents page</a>, the <strong>How I work</strong> box is the first thing every connected AI
          reads (through <Link href="/docs/tools#get_context">get_context</Link>). Treat it like a briefing for a new
          colleague: short, factual and specific.
        </p>
        <p>Good things to include:</p>
        <ul>
          <li><strong>Your role and work:</strong> what you do, and for whom.</li>
          <li><strong>Your clients or projects,</strong> and which SyncPads page each one lives on.</li>
          <li><strong>Your tools:</strong> where code, designs, tasks and documents live.</li>
          <li><strong>Standing preferences:</strong> tone, length, spelling, formats, deadlines.</li>
        </ul>
      </Prose>
      <div className="mt-4">
        <CodeBlock title="Example: freelance designer">{`I'm a freelance product designer (OmniCode LLC).
Clients: Acme (page "Acme": weekly report every Friday) and Globex (page "Globex").
Design in Figma, tasks in Linear, invoices in Stripe.
Keep answers short and practical. US spelling. Dates as "Nov 13".
When we decide something, save it to the client's page in SyncPads.`}</CodeBlock>
      </div>
      <div className="mt-4">
        <CodeBlock title="Example: developer">{`Full-stack developer. Main project: SyncPads (Next.js, TypeScript, MariaDB, Docker).
Docs and runbooks are on my "Engineering" page; API references on "Docs".
Prefer TypeScript examples and small, focused changes.
Never suggest storing secrets in code.`}</CodeBlock>
      </div>
      <div className="mt-4">
        <Callout tone="warning" title="Don't put secrets in it">
          Your How I work notes are shared with every AI you connect. Never include passwords, keys or private personal data.
        </Callout>
      </div>

      <H2 id="organize">2. Organize pages the way you think about work</H2>
      <Prose>
        <p>Your AI navigates SyncPads by page and group names, so make them say what they are.</p>
        <ul>
          <li><strong>One page per client or project</strong> (&ldquo;Acme&rdquo;, &ldquo;Q4 launch&rdquo;), plus one for everyday tools.</li>
          <li><strong>Name groups by purpose:</strong> &ldquo;Briefs&rdquo;, &ldquo;Dashboards&rdquo;, &ldquo;Logins&rdquo;, &ldquo;Reference&rdquo;.</li>
          <li>
            <strong>Title links clearly.</strong> &ldquo;Acme analytics (GA4)&rdquo; beats &ldquo;analytics.google.com&rdquo;.
            Untitled links get the page&apos;s own title automatically.
          </li>
          <li>
            <strong>Add notes beside links</strong> with context an AI can&apos;t guess: account names, conventions, who to
            ask. Notes are searchable too.
          </li>
          <li>
            <strong>Hide private pages</strong> (personal finance, health, anything sensitive) with <em>Hide this page from
            AI agents</em> in the page&apos;s settings.
          </li>
        </ul>
      </Prose>

      <H2 id="smart-features">3. Turn on smart features</H2>
      <Prose>
        <p>
          In Settings, <strong>Summaries and search by meaning</strong> gives every link a two-sentence summary and tags,
          which your AI sees when it searches or reads a page. On Pro, it also lets your AI find links by what they&apos;re
          about, not just their words. Page text is sent to Anthropic and Voyage AI only while this is on; see{" "}
          <Link href="/privacy">our privacy policy</Link>.
        </p>
      </Prose>

      <H2 id="prompts">4. Prompts that work</H2>
      <Prose>
        <p>You don&apos;t need special syntax. Mentioning SyncPads is usually enough. Some that work well:</p>
      </Prose>
      <H3>Starting a task</H3>
      <div className="space-y-2">
        <Prompt>&ldquo;Check SyncPads for context on the Globex project, then help me draft the kickoff email.&rdquo;</Prompt>
        <Prompt>&ldquo;Read my Engineering page in SyncPads before you suggest an approach.&rdquo;</Prompt>
      </div>
      <H3>Finding things</H3>
      <div className="space-y-2">
        <Prompt>&ldquo;Where's the Acme ad account? Look in SyncPads.&rdquo;</Prompt>
        <Prompt>&ldquo;What have I saved about onboarding emails?&rdquo;</Prompt>
      </div>
      <H3>Building up your workspace (Pro)</H3>
      <div className="space-y-2">
        <Prompt>&ldquo;Find the official docs for Stripe Checkout and add them to my Engineering page in SyncPads.&rdquo;</Prompt>
        <Prompt>&ldquo;Save this to SyncPads, on the Acme page.&rdquo;</Prompt>
        <Prompt>&ldquo;Save the open questions from this chat so we can pick it up tomorrow.&rdquo;</Prompt>
      </div>

      <H2 id="save-context">5. Save decisions as you go (Pro)</H2>
      <Prose>
        <p>
          The habit that pays off most: at the end of a useful conversation, say <strong>&ldquo;save this to
          SyncPads&rdquo;</strong>. Your AI writes a short note with a title, summary, decisions, open questions and links,
          and it lands in your <Link href="/docs/control#inbox">Agent Inbox</Link>. Approve it, and the next AI you use, in
          any app, can read what you decided instead of starting from scratch.
        </p>
        <p>
          Saying which page it belongs on (&ldquo;on the Acme page&rdquo;) keeps things organized. Passwords, keys and
          tokens are removed automatically, but it&apos;s still best not to paste them into chats.
        </p>
      </Prose>

      <H2 id="instructions">6. Tell your AI to always check SyncPads</H2>
      <Prose>
        <p>
          SyncPads already tells connected AIs to check your context first. To make it a firm habit, add a line to the
          instructions your app supports.
        </p>
      </Prose>
      <H3>Claude Projects, or ChatGPT custom instructions</H3>
      <div className="mt-2">
        <CodeBlock title="Project instructions">{`Before answering anything about my work, call SyncPads get_context (with a topic if there is one)
and use what it returns. Prefer links I've saved over web results.
When I say "save this", call SyncPads save_context with a short summary, decisions and open questions.`}</CodeBlock>
      </div>
      <H3>Cursor rule</H3>
      <div className="mt-2">
        <CodeBlock title=".cursor/rules/syncpads.mdc">{`---
description: Use SyncPads for project context and docs
alwaysApply: true
---
Before planning a change, call the SyncPads get_context tool with the feature as the topic.
Use docs and runbooks saved in SyncPads before searching the web.`}</CodeBlock>
      </div>
      <H3>Claude Code</H3>
      <div className="mt-2">
        <CodeBlock title="CLAUDE.md">{`## Context
Use the SyncPads MCP server: call get_context at the start of a task, and search SyncPads
for internal docs before looking elsewhere. Save important decisions with save_context.`}</CodeBlock>
      </div>

      <H2 id="workflows">7. Example workflows</H2>
      <Prose>
        <ul>
          <li>
            <strong>Client work:</strong> keep one page per client. Ask your AI to &ldquo;read the Acme page&rdquo; before
            drafting anything, and save decisions back to it after each session.
          </li>
          <li>
            <strong>Coding:</strong> keep docs, runbooks and dashboards on an Engineering page. Your coding agent checks them
            before writing code, so it follows your conventions instead of generic examples.
          </li>
          <li>
            <strong>Research:</strong> collect sources by topic. Ask &ldquo;what have I saved about X?&rdquo; before
            researching, and have your AI add the best new sources to your inbox.
          </li>
          <li>
            <strong>Switching AIs:</strong> plan in ChatGPT, save the decisions, then build in Cursor or Claude. Each one
            reads the same SyncPads.
          </li>
        </ul>
      </Prose>

      <NextPage href="/docs/control" title="Control and privacy" />
    </>
  );
}
