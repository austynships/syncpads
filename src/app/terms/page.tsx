import Link from "next/link";
import { Clarity } from "@/components/clarity";
import { LegalPage, Section } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Terms of Service",
  description: "The terms for using SyncPads.",
};

export default function TermsPage() {
  const mail = <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;

  return (
    <>
      <Clarity />
      <LegalPage
        title="Terms of Service"
        intro={
          <p>
            These terms are an agreement between you and {LEGAL.operator} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) for using
            SyncPads, including the website at syncpad.tech, the browser extension, and the connection AI agents use
            (together, &ldquo;SyncPads&rdquo;). By creating an account or using SyncPads, you agree to them. Our{" "}
            <Link href="/privacy">Privacy Policy</Link> explains how we handle your data.
          </p>
        }
      >
        <Section id="account" title="1. Your account">
          <ul>
            <li>You must be at least 16 years old to use SyncPads.</li>
            <li>Give us a real email address, and keep your password secure. You&apos;re responsible for activity in your account.</li>
            <li>Tell us right away at {mail} if you think someone has accessed your account without permission.</li>
          </ul>
        </Section>

        <Section id="content" title="2. Your content">
          <p>
            You own the links, notes and other content you put in SyncPads (&ldquo;your content&rdquo;). You give us
            permission to store, process and display it, and to send it to the services described in our Privacy Policy,
            only as needed to run SyncPads for you. That includes fetching the pages you save, sending page text to AI
            providers if you turn on smart features, and giving AI agents you connect the access you choose.
          </p>
          <p>You&apos;re responsible for your content and for having the right to save and share it.</p>
        </Section>

        <Section id="agents" title="3. AI features and connected agents">
          <ul>
            <li>
              Summaries, tags and search by meaning are produced by AI and can be wrong or incomplete. Check anything
              important.
            </li>
            <li>
              AI apps you connect (such as Claude, ChatGPT or Cursor) are run by other companies under their own terms. They
              act on your instructions and with the access you give them in Agents. We don&apos;t control what they do with
              what they read.
            </li>
            <li>
              Agents can&apos;t delete anything in SyncPads, and their additions wait in your Agent Inbox unless you choose
              otherwise. You&apos;re responsible for what you approve and for the access you grant.
            </li>
            <li>We remove things that look like secrets from context agents save, but this can&apos;t catch everything. Don&apos;t share passwords or keys with agents.</li>
          </ul>
        </Section>

        <Section id="acceptable-use" title="4. Acceptable use">
          <p>Don&apos;t use SyncPads to:</p>
          <ul>
            <li>break the law, or store or share content that infringes others&apos; rights;</li>
            <li>store passwords, payment card numbers or other credentials (SyncPads isn&apos;t a password manager);</li>
            <li>harm, probe or overload SyncPads or other systems, get around rate limits, or access other people&apos;s accounts;</li>
            <li>make SyncPads fetch addresses you aren&apos;t allowed to access, or use it to send spam or malware;</li>
            <li>resell or copy SyncPads, or use automated means to access it other than the connection we provide for AI agents.</li>
          </ul>
          <p>We may limit or suspend accounts that break these rules, and remove content that does.</p>
        </Section>

        <Section id="plans" title="5. Plans and payment">
          <p>
            SyncPads has a free plan and a paid plan, Pro. What each includes and costs is shown on our{" "}
            <Link href="/pricing">pricing page</Link>. The free plan has limits (such as the number of pages, links and
            connected agents); reaching one only stops you adding more, and never deletes anything.
          </p>
          <ul>
            <li>
              <strong>Billing.</strong> Pro is billed in advance, monthly or yearly, through Stripe, and renews
              automatically at the end of each period until you cancel. Prices are in US dollars and may include taxes
              where required.
            </li>
            <li>
              <strong>Cancelling.</strong> You can cancel any time in Account settings. You keep Pro until the end of the
              period you&apos;ve paid for, then move to the free plan.
            </li>
            <li>
              <strong>Refunds.</strong> Payments aren&apos;t refundable, including for partial periods, except where the
              law requires a refund. If you think you were charged by mistake, contact {mail}.
            </li>
            <li>
              <strong>Changes to price.</strong> If we change Pro&apos;s price, we&apos;ll tell you at least 30 days before
              it applies to you, and you can cancel before then.
            </li>
            <li>
              <strong>Failed payments.</strong> If a payment fails, Stripe retries it. If it still can&apos;t be collected,
              your account moves to the free plan.
            </li>
          </ul>
        </Section>

        <Section id="service" title="6. Changes and availability">
          <p>
            We&apos;re improving SyncPads all the time, so features may change. We aim to keep it running smoothly but
            can&apos;t promise it will always be available or free of errors. We may limit usage to keep the service fast
            and fair, as with the daily limits on AI agent requests.
          </p>
        </Section>

        <Section id="ending" title="7. Ending your use">
          <p>
            You can delete your account at any time in Account settings; your data is then deleted as described in our
            Privacy Policy. We may suspend or close an account that breaks these terms, or if we stop offering SyncPads, in
            which case we&apos;ll give reasonable notice where we can so you can save your content.
          </p>
        </Section>

        <Section id="disclaimers" title="8. Disclaimers and liability">
          <p>
            SyncPads is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the law allows, we make no
            warranties beyond those stated in these terms, and we aren&apos;t liable for indirect or consequential losses, or
            for lost data, profits or business. Our total liability for any claim about SyncPads is limited to the greater of
            the amount you paid us in the 12 months before the claim and 100 US dollars. Nothing in these terms limits
            liability that can&apos;t be limited by law, or your rights as a consumer where you live.
          </p>
        </Section>

        <Section id="changes" title="9. Changes to these terms">
          <p>
            We may update these terms. We&apos;ll change the date at the top and, for significant changes, tell you by email
            or in SyncPads before they take effect. If you keep using SyncPads after that, the new terms apply.
          </p>
        </Section>

        <Section id="law" title="10. Governing law">
          <p>
            These terms are governed by the laws of {LEGAL.governingLaw}, without regard to its conflict of laws rules,
            except where the law where you live gives you the right to rely on its rules or courts.
          </p>
        </Section>

        <Section id="contact" title="11. Contact">
          <p>{LEGAL.operator} · {mail}</p>
        </Section>
      </LegalPage>
    </>
  );
}
