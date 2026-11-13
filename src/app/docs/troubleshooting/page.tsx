import Link from "next/link";
import { DocTitle, H2, Prose } from "@/components/docs";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Troubleshooting" };

const issues: { id: string; problem: string; fix: React.ReactNode }[] = [
  {
    id: "no-connect",
    problem: "I added SyncPads, but nothing happened",
    fix: (
      <>
        <p>
          Adding a connector usually only saves the address. Look for a <strong>Connect</strong> button next to SyncPads in
          your app&apos;s connector list and click it; that opens SyncPads so you can sign in and allow access.
        </p>
        <p>On team plans, a workspace owner may need to add custom connectors.</p>
      </>
    ),
  },
  {
    id: "new-tools",
    problem: "My AI doesn't see a tool, or SyncPads at all",
    fix: (
      <p>
        Most apps load an MCP server&apos;s tools when a chat starts. Start a <strong>new chat</strong> (or reload the MCP
        server in Cursor or Claude Code). Also check that the connector is turned on for that chat.
      </p>
    ),
  },
  {
    id: "read-only",
    problem: "\"On SyncPads Free, agents can search and read only\" or \"This agent has read-only access\"",
    fix: (
      <p>
        Adding links and saving context need <Link href="/pricing">Pro</Link>, and the right access level for that AI. On the{" "}
        <a href="/agents">Agents page</a>, set its access to <strong>Read, add links and save context</strong>.
      </p>
    ),
  },
  {
    id: "one-agent",
    problem: "\"SyncPads Free includes 1 connected agent\"",
    fix: (
      <p>
        On Free, one AI can be connected. Disconnect the current one on the <a href="/agents">Agents page</a> to switch, or
        upgrade to Pro to connect as many as you like. Reconnecting the same app doesn&apos;t count as a second one.
      </p>
    ),
  },
  {
    id: "page-unavailable",
    problem: "\"That page isn't available to this agent\"",
    fix: (
      <p>
        The page is hidden from agents, or outside the pages you picked for that AI. Check the page&apos;s settings and the
        AI&apos;s <strong>Pages it can see</strong> on the <a href="/agents">Agents page</a>.
      </p>
    ),
  },
  {
    id: "not-found",
    problem: "Search doesn't find something I know I saved",
    fix: (
      <>
        <p>
          On Free, search matches words, so try the words in the link&apos;s title, address or notes. New links are indexed
          within about a minute after you save them.
        </p>
        <p>
          On Pro, turn on <strong>Summaries and search by meaning</strong> in Settings to find links by what they&apos;re
          about.
        </p>
      </>
    ),
  },
  {
    id: "inbox-empty",
    problem: "My AI says it saved something, but I don't see it",
    fix: (
      <p>
        Unless you let that AI skip the inbox, its additions wait in your <strong>Agent Inbox</strong> (the inbox button in
        your start page&apos;s top bar). Approve them to put them on a page.
      </p>
    ),
  },
  {
    id: "rate-limit",
    problem: "\"Rate limit reached\" or \"Daily limit reached\"",
    fix: (
      <p>
        Each AI can make 60 requests a minute and 2,000 a day on Free (10,000 on Pro). Wait a moment, or until tomorrow for
        the daily limit.
      </p>
    ),
  },
  {
    id: "signed-out",
    problem: "The connection stopped working or asks me to sign in again",
    fix: (
      <p>
        If you disconnected the AI on the Agents page, or it hasn&apos;t been used for over 30 days, reconnect it from your
        app. It keeps its history and settings.
      </p>
    ),
  },
];

export default function TroubleshootingPage() {
  return (
    <>
      <DocTitle
        eyebrow="Help"
        title="Troubleshooting"
        intro={<p>The most common problems, and how to fix them.</p>}
      />

      <div className="space-y-4">
        {issues.map((issue) => (
          <section key={issue.id} id={issue.id} className="scroll-mt-24 rounded-2xl border border-slate-900/[0.07] bg-white p-5">
            <h2 className="font-semibold text-slate-900">{issue.problem}</h2>
            <div className="mt-2">
              <Prose>{issue.fix}</Prose>
            </div>
          </section>
        ))}
      </div>

      <H2 id="contact">Still stuck?</H2>
      <Prose>
        <p>
          Email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> with the app you&apos;re connecting and the
          exact message you see.
        </p>
      </Prose>
    </>
  );
}
