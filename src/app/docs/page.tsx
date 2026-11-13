import Link from "next/link";
import { CodeBlock, DocTitle, H2, NextPage, Prompt, Prose } from "@/components/docs";
import { MCP_RESOURCE } from "@/server/oauth";

export const metadata = { title: "Overview" };

export default function DocsOverview() {
  return (
    <>
      <DocTitle
        eyebrow="SyncPads MCP"
        title="Give every AI you use the context of how you work"
        intro={
          <p>
            SyncPads is your start page: the links, docs and notes you rely on. The SyncPads MCP server lets Claude, ChatGPT,
            Cursor and other AI apps read it, search it and, if you allow it, add to it. You stop re-explaining your work in
            every chat, and what you decide in one AI is there for the next.
          </p>
        }
      />

      <Prose>
        <p>
          MCP (Model Context Protocol) is an open standard for connecting AI apps to tools and data. SyncPads runs an MCP
          server at this address:
        </p>
      </Prose>
      <div className="mt-3">
        <CodeBlock>{MCP_RESOURCE}</CodeBlock>
      </div>

      <H2 id="what-it-can-do">What your AI can do with SyncPads</H2>
      <Prose>
        <ul>
          <li>
            <strong>Understand how you work.</strong> It reads your own <Link href="/docs/guides#how-i-work">How I work</Link>{" "}
            notes first: your role, clients, tools and preferences.
          </li>
          <li>
            <strong>Find what you&apos;ve saved.</strong> It searches your links and notes by keyword, and by meaning on Pro,
            before it reaches for the web.
          </li>
          <li>
            <strong>Read whole pages.</strong> Ask about a project or client and it reads that page: every link, summary and
            note on it.
          </li>
          <li>
            <strong>Suggest links</strong> <span className="text-slate-500">(Pro)</span>. When it finds something useful, it
            adds it to your <Link href="/docs/control#inbox">Agent Inbox</Link> for you to approve.
          </li>
          <li>
            <strong>Save what you decide</strong> <span className="text-slate-500">(Pro)</span>. Say &ldquo;save this to
            SyncPads&rdquo; and it keeps a short note of the conversation&apos;s decisions, open questions and links, ready for
            any AI you use later.
          </li>
        </ul>
        <p>
          You stay in control: you choose what each AI may do and which pages it can see, every action is logged, and
          anything it added can be undone. See <Link href="/docs/control">Control and privacy</Link>.
        </p>
      </Prose>

      <H2 id="quick-start">Quick start (3 minutes)</H2>
      <Prose>
        <ol>
          <li>
            <strong>Fill your start page.</strong> <a href="/signup">Create your workspace</a>, then import your bookmarks in
            Settings or paste links onto the page. One page per project or client works best.
          </li>
          <li>
            <strong>Write your How I work notes.</strong> On the <a href="/agents">Agents page</a>, describe your role, your
            clients or projects, the tools you use and how you like answers.{" "}
            <Link href="/docs/guides#how-i-work">See examples</Link>.
          </li>
          <li>
            <strong>Connect your AI.</strong> Add the address above to Claude, ChatGPT, Cursor or another MCP app, sign in to
            SyncPads when it asks, and choose what it may do.{" "}
            <Link href="/docs/connect">Step-by-step for each app</Link>.
          </li>
          <li>
            <strong>Try it.</strong> In a new chat, ask:
          </li>
        </ol>
      </Prose>
      <div className="mt-4 space-y-2">
        <Prompt>&ldquo;What do I have saved in SyncPads about our website redesign?&rdquo;</Prompt>
        <Prompt>&ldquo;Check my SyncPads for the Acme analytics link.&rdquo;</Prompt>
        <Prompt>&ldquo;We&apos;re done here. Save this to SyncPads.&rdquo;</Prompt>
      </div>

      <H2 id="plans">Free and Pro</H2>
      <Prose>
        <p>
          On Free, one AI can connect and it can search and read. Pro lets any number of AIs connect, lets them add links and
          save context, and turns on search by meaning. Details are on the <Link href="/pricing">pricing page</Link> and in{" "}
          <Link href="/docs/control#plans">Plans and limits</Link>.
        </p>
      </Prose>

      <NextPage href="/docs/connect" title="Connect your AI" />
    </>
  );
}
