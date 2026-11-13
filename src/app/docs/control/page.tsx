import Link from "next/link";
import { DocTitle, H2, NextPage, Prose } from "@/components/docs";

export const metadata = { title: "Control and privacy" };

export default function ControlPage() {
  return (
    <>
      <DocTitle
        eyebrow="Control"
        title="Control and privacy"
        intro={
          <p>
            Your AI can use your workspace, but it can&apos;t take it over. Here&apos;s everything you control, and exactly
            what each AI can and can&apos;t do.
          </p>
        }
      />

      <H2 id="inbox">The Agent Inbox</H2>
      <Prose>
        <p>
          Links and notes an AI adds don&apos;t go straight onto your page. They wait in your <strong>Agent Inbox</strong>{" "}
          (the inbox button in your start page&apos;s top bar, with a count when something is waiting). Each one shows which
          AI added it and why. You can:
        </p>
        <ul>
          <li><strong>Approve</strong> it into any page and group, optionally editing a link&apos;s title first;</li>
          <li><strong>Dismiss</strong> it.</li>
        </ul>
        <p>
          If you trust an AI, turn on <strong>Skip the inbox</strong> for it on the <a href="/agents">Agents page</a>, and its
          additions go straight onto your page. Everything is still logged and can be undone.
        </p>
      </Prose>

      <H2 id="permissions">Permissions for each AI</H2>
      <Prose>
        <p>On the <a href="/agents">Agents page</a>, each connected AI has its own settings:</p>
        <ul>
          <li><strong>Access:</strong> read only; read and add links; or read, add links and save context.</li>
          <li><strong>Pages it can see:</strong> all pages, or only the ones you pick.</li>
          <li><strong>Skip the inbox:</strong> let its additions go straight onto your page.</li>
          <li><strong>Disconnect:</strong> its access stops immediately; its history stays in the activity log.</li>
        </ul>
        <p>Changes apply to the AI&apos;s next request; you don&apos;t need to reconnect it.</p>
      </Prose>

      <H2 id="hidden-pages">Hidden pages</H2>
      <Prose>
        <p>
          In a page&apos;s settings, <strong>Hide this page from AI agents</strong> makes it invisible to every AI: it
          never appears in searches, page lists or context, whatever each AI&apos;s own settings say.
        </p>
      </Prose>

      <H2 id="activity">Activity log and undo</H2>
      <Prose>
        <p>
          The Agents page lists everything each AI did: searches, pages read, links added and context saved, with the time
          and the AI&apos;s reason. Anything an AI added can be <strong>undone for 30 days</strong>, which moves it to the
          trash. Searches and reads are kept for 30 days; additions are kept until you delete your account.
        </p>
      </Prose>

      <H2 id="safety">What AIs can never do</H2>
      <Prose>
        <ul>
          <li>Delete or edit anything you saved.</li>
          <li>See pages you&apos;ve hidden from agents.</li>
          <li>Follow instructions hidden in saved web pages: saved content is always handed to them as untrusted data.</li>
          <li>
            Store secrets: anything that looks like a password, API key, token, private key or card number is removed from
            saved context before it&apos;s written.
          </li>
          <li>Reach your account settings, billing or password.</li>
        </ul>
      </Prose>

      <H2 id="privacy">Where your data goes</H2>
      <Prose>
        <p>
          When an AI reads your SyncPads, that content is sent to the AI app you connected, under that provider&apos;s own
          terms and your account with them. SyncPads stores connection tokens only as hashes and never sees your password
          for those apps. If you turn on smart features, page text is also sent to Anthropic (summaries) and Voyage AI
          (search by meaning). Full details are in our <Link href="/privacy">privacy policy</Link>.
        </p>
      </Prose>

      <H2 id="plans">Plans and limits</H2>
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-900/[0.08] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-900">
            <tr>
              <th className="px-4 py-2.5 font-semibold" />
              <th className="px-4 py-2.5 font-semibold">Free</th>
              <th className="px-4 py-2.5 font-semibold">Pro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/[0.06] text-slate-700">
            {[
              ["Connected AIs", "1", "Unlimited"],
              ["AI access", "Read only", "Read, add links, save context"],
              ["Search by meaning", "No (keyword only)", "Yes"],
              ["Summaries", "First 100 links", "Every link"],
              ["AI requests", "2,000 a day", "10,000 a day"],
              ["Pages and links", "3 and 500", "Unlimited"],
            ].map(([label, free, pro]) => (
              <tr key={label}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{label}</td>
                <td className="px-4 py-2.5">{free}</td>
                <td className="px-4 py-2.5">{pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Prose>
        <p className="mt-4">
          Every AI is also limited to 60 requests a minute. Reaching a limit only blocks that action: nothing you saved is
          ever removed. See <Link href="/pricing">pricing</Link>.
        </p>
      </Prose>

      <NextPage href="/docs/troubleshooting" title="Troubleshooting" />
    </>
  );
}
