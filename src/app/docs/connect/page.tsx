import Link from "next/link";
import { Callout, CodeBlock, DocTitle, H2, H3, NextPage, Prose } from "@/components/docs";
import { MCP_RESOURCE } from "@/server/oauth";

export const metadata = { title: "Connect your AI" };

export default function ConnectPage() {
  return (
    <>
      <DocTitle
        eyebrow="Setup"
        title="Connect your AI"
        intro={
          <p>
            Any app that supports remote MCP servers with sign-in (OAuth) can connect. You never copy keys: the app opens
            SyncPads, you sign in and choose what it may do, and it&apos;s connected.
          </p>
        }
      />

      <Prose>
        <p>The address to add in every app:</p>
      </Prose>
      <div className="mt-3">
        <CodeBlock>{MCP_RESOURCE}</CodeBlock>
      </div>
      <div className="mt-4">
        <Callout title="Menu names change">
          The steps below match each app at the time of writing. If a menu is called something slightly different, look for
          &ldquo;connectors&rdquo;, &ldquo;integrations&rdquo; or &ldquo;MCP servers&rdquo; in the app&apos;s settings.
        </Callout>
      </div>

      <H2 id="claude">Claude (web and desktop)</H2>
      <Prose>
        <ol>
          <li>Open <strong>Settings → Connectors</strong> and choose <strong>Add custom connector</strong>.</li>
          <li>Name it <code>SyncPads</code>, paste the address above, and add it.</li>
          <li>Click <strong>Connect</strong> next to SyncPads. A SyncPads tab opens: sign in, choose what Claude may do, and click <strong>Allow</strong>.</li>
          <li>Start a <strong>new chat</strong>. Claude loads SyncPads&apos; tools when a chat starts.</li>
        </ol>
        <p>
          On team plans, a workspace owner may need to add custom connectors. To make Claude check SyncPads without asking,
          add a line to a Project&apos;s instructions: <Link href="/docs/guides#instructions">see the snippet</Link>.
        </p>
      </Prose>

      <H2 id="chatgpt">ChatGPT</H2>
      <Prose>
        <ol>
          <li>
            Open <strong>Settings</strong> and find <strong>Connectors</strong> (sometimes under <em>Apps</em>). Custom
            connectors may require turning on <strong>developer mode</strong> first.
          </li>
          <li>Create a connector, paste the address above, and choose <strong>OAuth</strong> for authentication.</li>
          <li>ChatGPT opens SyncPads: sign in, choose what it may do, and click <strong>Allow</strong>.</li>
          <li>Turn the connector on in a chat and ask it to check SyncPads.</li>
        </ol>
      </Prose>

      <H2 id="cursor">Cursor</H2>
      <Prose>
        <p>
          Open <strong>Settings → MCP</strong> and add a new server, or add SyncPads to your <code>mcp.json</code> (in your
          project&apos;s <code>.cursor</code> folder, or your global Cursor settings):
        </p>
      </Prose>
      <div className="mt-3">
        <CodeBlock title="mcp.json">{`{
  "mcpServers": {
    "syncpads": {
      "url": "${MCP_RESOURCE}"
    }
  }
}`}</CodeBlock>
      </div>
      <Prose>
        <p className="mt-4">
          Cursor opens SyncPads in your browser to sign in. Then ask the agent to check SyncPads for your docs, or add a{" "}
          <Link href="/docs/guides#instructions">Cursor rule</Link> so it always does.
        </p>
      </Prose>

      <H2 id="claude-code">Claude Code</H2>
      <Prose>
        <p>Add SyncPads as a remote (HTTP) MCP server:</p>
      </Prose>
      <div className="mt-3">
        <CodeBlock title="Terminal">{`claude mcp add --transport http syncpads ${MCP_RESOURCE}`}</CodeBlock>
      </div>
      <Prose>
        <p className="mt-4">
          Then run <code>/mcp</code> inside Claude Code and choose SyncPads to sign in. Add a line to your{" "}
          <code>CLAUDE.md</code> so it checks SyncPads first (<Link href="/docs/guides#instructions">snippet</Link>).
        </p>
      </Prose>

      <H2 id="other-apps">Other MCP apps</H2>
      <Prose>
        <p>
          Add a <strong>remote MCP server</strong> using <strong>Streamable HTTP</strong> with the address above. SyncPads
          supports the standard MCP sign-in: the app discovers it automatically, registers itself, and opens SyncPads for you
          to allow it. There&apos;s no API key to paste.
        </p>
      </Prose>

      <H2 id="access">Choosing what it may do</H2>
      <Prose>
        <p>When an AI connects, you pick one of three levels. You can change it any time on the <a href="/agents">Agents page</a>.</p>
      </Prose>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-900/[0.08] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-900">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Level</th>
              <th className="px-4 py-2.5 font-semibold">It can</th>
              <th className="px-4 py-2.5 font-semibold">Plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/[0.06] text-slate-700">
            <tr>
              <td className="px-4 py-2.5 font-medium text-slate-900">Read only</td>
              <td className="px-4 py-2.5">Read your How I work notes, search, list and read pages</td>
              <td className="px-4 py-2.5">Free and Pro</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-medium text-slate-900">Read and add links</td>
              <td className="px-4 py-2.5">The above, plus suggest links for your inbox</td>
              <td className="px-4 py-2.5">Pro</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-medium text-slate-900">Read, add links and save context</td>
              <td className="px-4 py-2.5">The above, plus save notes from your conversations</td>
              <td className="px-4 py-2.5">Pro</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Prose>
        <p className="mt-4">
          No AI can ever delete anything in SyncPads, and pages you hide from agents are invisible to all of them.
        </p>
      </Prose>

      <H3 id="reconnecting">Reconnecting or switching apps</H3>
      <Prose>
        <p>
          Reconnecting the same app keeps it as the same agent, with its history and settings. On Free you can connect one
          AI; to switch, disconnect the current one on the <a href="/agents">Agents page</a> first.
        </p>
      </Prose>

      <NextPage href="/docs/tools" title="Tools reference" />
    </>
  );
}
