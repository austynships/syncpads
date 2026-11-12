import { describe, expect, it } from "vitest";
import { sanitizeNoteHtml } from "@/lib/sanitize";
import { normalizeUrl } from "@/lib/url";
import { findIconHref } from "@/server/favicon";
import { isPrivateAddress, safeFetch } from "@/server/safe-fetch";

describe("normalizeUrl", () => {
  it("adds https:// and keeps valid URLs", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
    expect(normalizeUrl(" https://docs.example.com/a?b=1 ")).toBe("https://docs.example.com/a?b=1");
  });
  it("rejects dangerous or invalid input", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("data:text/html,hi")).toBeNull();
    expect(normalizeUrl("hello world")).toBeNull();
    expect(normalizeUrl("notaurl")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
});

describe("sanitizeNoteHtml", () => {
  it("keeps formatting and strips scripts, handlers and bad links", () => {
    const html = sanitizeNoteHtml(
      `<p onclick="x()">Hi <strong>there</strong><script>alert(1)</script></p><a href="javascript:alert(1)">bad</a><a href="https://ok.com">ok</a><img src=x onerror=alert(1)>`,
    );
    expect(html).toContain("<strong>there</strong>");
    expect(html).not.toMatch(/script|onclick|onerror|javascript:|<img/i);
    expect(html).toContain('href="https://ok.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("SSRF protection", () => {
  it("flags private and special addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.5.4", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "100.64.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("refuses to fetch private hosts, odd ports and other schemes", async () => {
    await expect(safeFetch("http://127.0.0.1/")).rejects.toThrow(/Private/);
    await expect(safeFetch("http://169.254.169.254/latest/meta-data")).rejects.toThrow(/Private/);
    await expect(safeFetch("http://localhost/")).rejects.toThrow(/Private/);
    await expect(safeFetch("https://example.com:8443/")).rejects.toThrow(/port/);
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(/http/);
  });
});

describe("findIconHref", () => {
  it("finds icon links in HTML", () => {
    expect(findIconHref(`<head><link rel="stylesheet" href="a.css"><link rel="shortcut icon" href="/fav.png"></head>`)).toBe("/fav.png");
    expect(findIconHref(`<link href='/apple.png' rel='apple-touch-icon'>`)).toBe("/apple.png");
    expect(findIconHref(`<p>no icons</p>`)).toBeNull();
  });
});

