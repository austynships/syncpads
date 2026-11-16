import Link from "next/link";
import { Callout, DocTitle, H2, NextPage, Prose } from "@/components/docs";

export const metadata = {
  title: "Share a page",
  description: "Send anyone a link to one of your pages. They can view it and save a copy to their own SyncPads.",
};

export default function SharingPage() {
  return (
    <>
      <DocTitle
        eyebrow="Your data"
        title="Share a page"
        intro={
          <p>
            Send anyone a link to one of your pages: a list of tools for a new teammate, resources for a client, or your
            favorite reading. Choose whether they can only view it, or edit it with you.
          </p>
        }
      />

      <H2 id="share">Share in one click</H2>
      <Prose>
        <ol>
          <li>Open the page you want to share.</li>
          <li>
            Click <strong>Share</strong> in the top bar.
          </li>
          <li>
            Under <strong>Anyone with the link can</strong>, pick <strong>View</strong> or <strong>Edit</strong>.
          </li>
          <li>
            Click <strong>Create link and copy it</strong>. The link is now on your clipboard: paste it into an email, a chat
            or a document.
          </li>
        </ol>
        <p>You can switch between View and Edit at any time; the link stays the same.</p>
        <p>
          The <strong>Share</strong> button turns orange and reads <strong>Shared</strong> while a page is shared. Click it any
          time to copy the link again, use <strong>Preview</strong> to see exactly what others see, or, on a phone, use{" "}
          <strong>Send…</strong> to share it straight to an app.
        </p>
      </Prose>

      <H2 id="what-they-see">What people with the link see</H2>
      <Prose>
        <ul>
          <li>The page&apos;s name, its groups and links, in the same order and layout as yours.</li>
          <li>
            Its widgets, live: clocks, weather, countdowns and news feeds. To-do lists count as notes, so they only show when
            you include notes.
          </li>
          <li>Your first name (&ldquo;Shared by Alex&rdquo;), and nothing else about you: no email or account details.</li>
          <li>
            Notes only if you turn on <strong>Include notes</strong>. It&apos;s off by default, because notes can hold
            private details, including context your AI saved.
          </li>
        </ul>
        <p>
          They never see your other pages, your Agent Inbox, your trash, or AI summaries. They don&apos;t need an account to
          view it, and they can&apos;t change it unless the link allows editing and they join.
        </p>
        <p>
          The page stays up to date: when you add or remove a link, everyone with the link sees the change the next time they
          open it.
        </p>
      </Prose>

      <H2 id="edit">Let people edit</H2>
      <Prose>
        <p>
          With <strong>Edit</strong>, anyone who opens the link can click <strong>Edit this page</strong>. They sign in (or
          create a free account), and the page appears as a tab in their own SyncPads, marked with a people icon. From there
          they work on it like any of their pages: add and edit links, notes and groups, drag things around, rename it or
          change its columns. Everyone on the page sees each other&apos;s changes within a few seconds.
        </p>
        <ul>
          <li>
            <strong>Editors see everything on the page</strong>, notes included. The &ldquo;Include notes&rdquo; setting only
            applies to people who view the link without joining.
          </li>
          <li>
            <strong>Editors can pass the link on</strong>, so anyone they send it to can join too. To control who joins,
            switch the link to View, or stop sharing.
          </li>
          <li>
            <strong>Only you</strong> can delete the page, hide it from AI agents, change sharing or remove people. Editors
            can leave the page from <strong>Share</strong> or <strong>Settings</strong>.
          </li>
          <li>
            Links and notes on your page count toward <strong>your</strong> plan&apos;s limits, whoever adds them. Things
            can&apos;t be dragged between someone&apos;s own pages and a page shared with them.
          </li>
        </ul>
        <p>
          To see who can edit, open <strong>Share</strong>: <strong>People who can edit</strong> lists everyone who joined,
          with a <strong>Remove</strong> button for each. Switching the link to View, or stopping sharing, removes everyone
          at once; the page disappears from their SyncPads.
        </p>
      </Prose>

      <H2 id="notifications">Notifications</H2>
      <Prose>
        <p>
          The bell in your top bar keeps everyone on a shared page in the loop. You get a notification when someone joins
          your page, adds links, notes or widgets to a page you share, or leaves it, and when you&apos;re removed from a page or its
          owner stops sharing or deletes it. A burst of changes arrives as one notification, such as &ldquo;Eddie added 4
          links and a note&rdquo;, and clicking it opens the page.
        </p>
        <p>The bell also shows news about SyncPads, and suggestions your AI leaves in your Agent Inbox.</p>
      </Prose>

      <H2 id="save-a-copy">Saving a copy</H2>
      <Prose>
        <p>
          Anyone viewing a shared page can click <strong>Save a copy</strong>. If they have a SyncPads account, the page is
          added to theirs as a new page straight away. If not, they create a free account and come right back to save it.
        </p>
        <p>
          A copy is theirs: it doesn&apos;t change when you edit your page, and nothing they do to it affects yours. The share
          dialog shows how many people have saved a copy.
        </p>
      </Prose>

      <H2 id="stop-sharing">Stop sharing</H2>
      <Prose>
        <p>
          Click <strong>Shared</strong>, then <strong>Stop sharing</strong>. The link stops working immediately for everyone,
          and people who joined to edit lose the page. Copies people already saved stay in their accounts. If you share the page again later, it gets a new link, so the
          old one never comes back to life.
        </p>
      </Prose>

      <Callout title="Unlisted, not secret">
        Shared pages aren&apos;t listed anywhere or shown to search engines, but anyone who has the link can open it and pass
        it on. Only share pages you&apos;re happy for others to see, and stop sharing when you no longer need it.
      </Callout>

      <H2 id="ai">Sharing and your AI</H2>
      <Prose>
        <p>
          Sharing doesn&apos;t change what your own AI can see. To keep a page away from your AI, use{" "}
          <Link href="/docs/control#hidden-pages">Hide this page from AI agents</Link>. A shared page can be hidden from your
          AI, and a hidden page can still be shared.
        </p>
        <p>
          A page someone shared with you to edit is available to your AI too, to search and read, unless its owner hid it
          from AI agents; then it&apos;s hidden from everyone&apos;s AI. AIs can&apos;t add links or save context to a page
          shared with you, only to your own pages.
        </p>
        <p>
          To hand someone everything at once instead, <Link href="/docs/import-export#export">export your pages</Link> as a
          SyncPads file; they can import it.
        </p>
      </Prose>

      <NextPage href="/docs/troubleshooting" title="Troubleshooting" />
    </>
  );
}
