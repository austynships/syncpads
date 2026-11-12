import Link from "next/link";
import { Clarity } from "@/components/clarity";
import { LegalPage, Section } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy",
  description: "What SyncPads collects, why, who it's shared with, and the choices you have.",
};

// Keep this page in step with what the product actually does. When a feature,
// service provider or retention period changes, update the matching section.
export default function PrivacyPage() {
  const mail = <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;

  return (
    <>
      <Clarity />
      <LegalPage
        title="Privacy Policy"
        intro={
          <>
            <p>
              SyncPads is a start page that keeps your links, notes and context in one place, and lets AI tools you connect
              use it. This policy explains what we collect, why, who it&apos;s shared with, and the choices you have. In
              short: we don&apos;t sell your data, we don&apos;t show ads, and AI providers only receive your content when you
              turn that on.
            </p>
            <p className="mt-3">
              SyncPads is run by {LEGAL.operator} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). Questions about this policy or your
              data: {mail}.
            </p>
          </>
        }
      >
        <Section id="collect" title="1. What we collect">
          <p><strong>Your account.</strong> Your name and email address, and your password, which we store only as a one-way Argon2id hash (we can&apos;t read it).</p>
          <p><strong>Your workspace.</strong> The pages, groups, links and notes you create or import, your appearance settings, and the &ldquo;How I work&rdquo; notes you write for AI agents.</p>
          <p>
            <strong>Page content we fetch.</strong> When you save a link, our server visits that page to store its title and
            readable text, so you can search it later and untitled links get a proper name.
          </p>
          <p>
            <strong>Smart features (off unless you turn them on).</strong> If you turn on summaries and search by meaning in
            Settings, the text of pages you save is sent to Anthropic to write a short summary and tags, and to Voyage AI to
            make search by meaning work. The results are stored with your links.
          </p>
          <p>
            <strong>AI agents you connect.</strong> If you connect an app such as Claude, ChatGPT or Cursor, we store which
            app it is, the access you gave it, and a log of what it did (what it searched for, which pages it read, and what
            it added or saved). Access tokens are stored only as hashes. Notes an agent saves from a conversation are stored
            like your other notes; before saving, we remove anything that looks like a password, API key or other secret.
          </p>
          <p>
            <strong>Security and sign-in.</strong> For your signed-in sessions we store the IP address and browser
            description reported when you sign in. To stop password guessing, we briefly count failed sign-in attempts per
            email address and IP address (these counters expire after 15 minutes). Our server records basic information about
            requests from AI agents (time, address requested, result and the app&apos;s name), never tokens or the content of
            requests.
          </p>
          <p>
            <strong>Payments.</strong> If you subscribe to Pro, Stripe collects your payment details on its own pages; they
            never reach our servers. We store your Stripe customer ID and your subscription&apos;s status, billing period
            and renewal date, so we know which plan you&apos;re on.
          </p>
          <p>
            <strong>Analytics on our public pages (only with your consent).</strong> If you accept analytics cookies, our
            public pages (home, pricing, sign-in, sign-up, this policy and our terms) use Microsoft Clarity to record how visitors
            use them: clicks, scrolling and what&apos;s on screen. Clarity never runs inside your workspace or account pages.
          </p>
        </Section>

        <Section id="use" title="2. How we use it">
          <ul>
            <li>To run SyncPads: show and sync your workspace, search it, and answer the AI agents you connected.</li>
            <li>To send account emails (verifying your address, resetting your password).</li>
            <li>To keep accounts and the service secure, and to prevent abuse (sign-in limits, agent rate limits).</li>
            <li>With your consent, to understand how visitors use our public pages so we can improve them.</li>
          </ul>
          <p>We don&apos;t sell your personal information, we don&apos;t use it for advertising, and we don&apos;t use your content to train AI models.</p>
        </Section>

        <Section id="sharing" title="3. Who we share it with">
          <p>We share data only with the services that run SyncPads, and only what each one needs:</p>
          <ul>
            <li><strong>Hostinger</strong> hosts our servers and database, located in the United States.</li>
            <li><strong>Resend</strong> sends our account emails (your email address and the message).</li>
            <li><strong>Stripe</strong> processes Pro payments (your name, email address and payment details).</li>
            <li><strong>Anthropic</strong> writes summaries and tags, only if you turned on smart features (the text of pages you save).</li>
            <li><strong>Voyage AI</strong> powers search by meaning, only if you turned on smart features (page text, summaries and your search words).</li>
            <li><strong>Microsoft</strong> provides Clarity analytics on our public pages, only if you accept analytics cookies.</li>
          </ul>
          <p>
            <strong>AI apps you connect.</strong> When you connect an app like Claude, ChatGPT or Cursor, the links, notes and
            pages it reads are sent to that app at your request. That provider handles them under its own terms and privacy
            policy and your account with it. You choose what each app may see in Agents, and you can disconnect it at any time.
          </p>
          <p>We may also disclose information if the law requires it, or to protect the safety of our users or the service.</p>
        </Section>

        <Section id="cookies" title="4. Cookies and similar technology">
          <ul>
            <li>
              <strong>Essential:</strong> one cookie keeps you signed in. It&apos;s needed for SyncPads to work, so it
              doesn&apos;t require consent.
            </li>
            <li>
              <strong>Saved in your browser:</strong> SyncPads keeps a copy of your workspace and a few preferences (like the
              page you last viewed and your cookie choice) in your browser&apos;s local storage, so it loads instantly and works
              offline. This stays on your device.
            </li>
            <li>
              <strong>Analytics (optional):</strong> Microsoft Clarity sets cookies on our public pages only if you click
              Accept in the cookie banner.
            </li>
          </ul>
          <p>
            You can change your choice at any time with &ldquo;Cookie settings&rdquo; at the bottom of our public pages.
          </p>
        </Section>

        <Section id="retention" title="5. How long we keep it">
          <ul>
            <li>Your account and workspace: until you delete your account.</li>
            <li>
              Items you delete go to the trash so you can undo the deletion. They stay there until you delete your account.
            </li>
            <li>
              When you delete your account, your data is removed from our live database immediately, and any Pro
              subscription is cancelled. Stripe keeps records of past payments as the law requires.
            </li>
            <li>
              Backups: our nightly database backups are kept for 14 days, and our hosting provider keeps its own backups of
              the server, so deleted data can remain in a backup for a limited time before it is overwritten.
            </li>
            <li>Agent activity: searches and page reads are kept for 30 days; additions and saved context are kept until you delete your account.</li>
            <li>Expired sign-in tokens for agents are deleted after 7 days.</li>
          </ul>
        </Section>

        <Section id="choices" title="6. Your choices and rights">
          <ul>
            <li>Edit or delete anything in your workspace at any time.</li>
            <li>Turn smart features off in Settings to stop sending page text to AI providers.</li>
            <li>Change what each AI agent can see, hide pages from all agents, or disconnect an agent in Agents.</li>
            <li>Delete your account and data in Account settings.</li>
            <li>Ask us for a copy of your data, or to correct it, by emailing {mail}.</li>
          </ul>
          <p>
            Depending on where you live, you may have further rights, such as to object to or restrict certain processing,
            or to complain to your data protection authority. We&apos;ll respond to requests within 30 days.
          </p>
        </Section>

        <Section id="security" title="7. Security">
          <p>
            Connections use HTTPS. Passwords are hashed with Argon2id, agent tokens are stored only as hashes, sign-in
            attempts are rate-limited, and our database isn&apos;t reachable from the internet. No system is perfectly secure,
            so please use a strong, unique password, and don&apos;t store passwords or keys in your notes.
          </p>
        </Section>

        <Section id="international" title="8. Where your data is processed">
          <p>
            Our servers are in the United States, and our service providers may process data in other countries. Wherever
            your data is processed, we protect it as this policy describes.
          </p>
        </Section>

        <Section id="children" title="9. Children">
          <p>SyncPads isn&apos;t meant for children under 16, and we don&apos;t knowingly collect their information.</p>
        </Section>

        <Section id="changes" title="10. Changes to this policy">
          <p>
            If we change this policy, we&apos;ll update the date at the top. If the changes are significant, we&apos;ll
            tell you by email or in SyncPads before they take effect.
          </p>
        </Section>

        <Section id="contact" title="11. Contact">
          <p>
            {LEGAL.operator} · {mail}. See also our <Link href="/terms">Terms of Service</Link>.
          </p>
        </Section>
      </LegalPage>
    </>
  );
}
