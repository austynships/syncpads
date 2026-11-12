import { describe, expect, it } from "vitest";
import { countLinks, decodeEntities, parseBookmarksHtml, planImport, type BookmarkNode } from "@/lib/bookmarks";

// Trimmed copy of what Chrome's "Export bookmarks" writes.
const CHROME_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" LAST_MODIFIED="1700000001" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://github.com/" ADD_DATE="1700000000" ICON="data:image/png;base64,AAAA">GitHub</A>
        <DT><H3 ADD_DATE="1700000000">Work</H3>
        <DL><p>
            <DT><A HREF="https://linear.app/">Linear</A>
            <DT><H3>Clients</H3>
            <DL><p>
                <DT><A HREF="https://acme.example.com/?a=1&amp;b=2">Acme &amp; Co</A>
            </DL><p>
        </DL><p>
        <DT><H3>Empty folder</H3>
        <DL><p>
        </DL><p>
    </DL><p>
    <DT><A HREF="https://loose.example.com/">Loose link</A>
    <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
</DL><p>
`;

describe("parseBookmarksHtml", () => {
  it("reads folders and links from a Chrome export", () => {
    const tree = parseBookmarksHtml(CHROME_EXPORT);
    expect(tree.map((n) => n.title)).toEqual(["Bookmarks bar", "Loose link", "Bookmarklet"]);
    const bar = tree[0];
    expect(bar.children?.map((n) => n.title)).toEqual(["GitHub", "Work", "Empty folder"]);
    const work = bar.children![1];
    expect(work.children?.[0]).toEqual({ title: "Linear", url: "https://linear.app/" });
    expect(work.children?.[1].children?.[0]).toEqual({
      title: "Acme & Co",
      url: "https://acme.example.com/?a=1&b=2",
    });
    expect(countLinks(tree)).toBe(5);
  });

  it("handles lowercase tags, single quotes and missing <p>", () => {
    const html = `<dl><dt><h3>Folder</h3><dl><dt><a href='https://a.example.com'>A</a></dl></dl>`;
    expect(parseBookmarksHtml(html)).toEqual([
      { title: "Folder", children: [{ title: "A", url: "https://a.example.com" }] },
    ]);
  });

  it("returns nothing for files that aren't bookmark exports", () => {
    expect(parseBookmarksHtml("<html><body><p>Hello</p></body></html>")).toEqual([]);
  });

  it("decodes numeric and named entities", () => {
    expect(decodeEntities("Caf&#233; &#x2014; &lt;b&gt; &unknown;")).toBe("Café — <b> &unknown;");
  });
});

describe("planImport", () => {
  it("maps top-level folders to pages and subfolders to groups", () => {
    const plan = planImport(parseBookmarksHtml(CHROME_EXPORT));
    expect(plan.pages.map((p) => p.name)).toEqual(["Bookmarks bar", "Imported"]);

    const bar = plan.pages[0];
    expect(bar.groups.map((g) => g.name)).toEqual(["Links", "Work", "Work / Clients"]);
    expect(bar.groups[0].links).toEqual([{ url: "https://github.com/", title: "GitHub" }]);
    expect(plan.pages[1].groups[0].links).toEqual([{ url: "https://loose.example.com/", title: "Loose link" }]);

    expect(plan.linkCount).toBe(4);
    expect(plan.groupCount).toBe(4);
    expect(plan.skipped).toBe(1); // the javascript: bookmarklet
  });

  it("skips empty folders and untitled names get a fallback", () => {
    const tree: BookmarkNode[] = [
      { title: "", children: [{ title: "", children: [{ title: "", url: "example.com" }] }] },
      { title: "Nothing here", children: [] },
    ];
    const plan = planImport(tree);
    expect(plan.pages).toEqual([
      { name: "Imported", groups: [{ name: "Folder", links: [{ url: "https://example.com/", title: null }] }] },
    ]);
  });

  it("rejects imports over the link limit", () => {
    const links = Array.from({ length: 10_001 }, (_, i) => ({ title: "", url: `https://e${i}.example.com/` }));
    expect(() => planImport([{ title: "Big", children: links }])).toThrow(/10,000/);
  });

  it("imports 2,000 links quickly (SP-9)", () => {
    const folders = Array.from({ length: 20 }, (_, f) => ({
      title: `Folder ${f}`,
      children: Array.from({ length: 100 }, (_, i) => ({ title: `Link ${i}`, url: `https://site${f}-${i}.example.com/` })),
    }));
    const started = performance.now();
    const plan = planImport([{ title: "Bar", children: folders }]);
    expect(plan.linkCount).toBe(2000);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
