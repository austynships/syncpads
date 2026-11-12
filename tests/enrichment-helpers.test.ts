import { describe, expect, it } from "vitest";
import { cleanSummary, embeddingText } from "@/server/enrichment/ai";
import { extractFromHtml, noteText } from "@/server/enrichment/extract";
import { fuseRanks, searchTerms } from "@/server/search";

describe("extractFromHtml", () => {
  const html = `<!doctype html><html><head>
    <title>  Linear &ndash; Plan and build products </title>
    <meta property="og:title" content="Linear: issue tracking">
    <meta name="description" content="Linear helps teams plan &amp; build.">
    <style>.x{color:red}</style><script>alert("x")</script>
  </head><body>
    <nav>Home Pricing Login</nav>
    <main><h1>Meet the system</h1><p>Linear is a purpose-built tool for&nbsp;planning.</p>
    <ul><li>Issues</li><li>Projects</li></ul></main>
    <footer>© Linear</footer>
  </body></html>`;

  it("prefers og:title, reads the description and keeps only readable body text", () => {
    const out = extractFromHtml(html);
    expect(out.title).toBe("Linear: issue tracking");
    expect(out.description).toBe("Linear helps teams plan & build.");
    expect(out.text).toBe("Meet the system\nLinear is a purpose-built tool for planning.\nIssues\nProjects");
    expect(out.text).not.toMatch(/alert|color|Pricing|©/);
  });

  it("falls back to <title> and handles pages without one", () => {
    expect(extractFromHtml("<title>A &amp; B</title><p>x</p>").title).toBe("A & B");
    expect(extractFromHtml("<p>No title here</p>")).toEqual({ title: null, description: null, text: "No title here" });
  });

  it("reads note text", () => {
    expect(noteText("<h3>This week</h3><ul><li>Ship it</li></ul>")).toBe("This week\nShip it");
  });
});

describe("search helpers", () => {
  it("splits queries into distinct terms of 2+ characters", () => {
    expect(searchTerms("  Design  design a  System ")).toEqual(["design", "system"]);
  });

  it("ranks items found by both keyword and meaning first", () => {
    expect(fuseRanks([["a", "b", "c"], ["c", "d"]])).toEqual(["c", "a", "b", "d"]); // b and d tie; first seen wins
  });
});

describe("AI helpers", () => {
  it("cleans tags and caps lengths", () => {
    expect(cleanSummary({ summary: "  Short. ", tags: ["#Design", "design", "  React ", ""] })).toEqual({
      summary: "Short.",
      tags: ["design", "react"],
    });
  });

  it("builds the text that represents an item for search by meaning", () => {
    expect(embeddingText({ title: "Linear", url: "https://linear.app/", summary: "Issue tracking.", tags: ["pm"], text: "Body" })).toBe(
      "Linear\nhttps://linear.app/\nIssue tracking.\nTags: pm\nBody",
    );
  });
});
