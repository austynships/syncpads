import { describe, expect, it } from "vitest";
import { REDACTED, redactSecrets, redactUrl } from "@/server/redact";

describe("redactSecrets", () => {
  it("removes provider keys and tokens", () => {
    const keys = [
      "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789",
      "sk-proj-abcdefghijklmnopqrstuvwx1234",
      "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
      "AKIAABCDEFGHIJKLMNOP",
      "xoxb-1234567890-abcdefghij",
      "sk_live_abcdefghijklmnop1234",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
    ];
    for (const key of keys) {
      const { text, removed } = redactSecrets(`use ${key} here`);
      expect(text, key).toBe(`use ${REDACTED} here`);
      expect(removed).toBe(1);
    }
  });

  it("removes labeled passwords and keys but keeps the label", () => {
    expect(redactSecrets("The staging password is hunter2-xyz, ask Sam.").text).toBe(
      `The staging password is ${REDACTED}, ask Sam.`,
    );
    expect(redactSecrets('api_key="abc123def456"').text).toBe(`api_key=${REDACTED}`);
  });

  it("removes Bearer tokens, URL credentials, private keys and card numbers", () => {
    expect(redactSecrets("Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456").text).toBe(`Authorization: ${REDACTED}`);
    expect(redactSecrets("db at postgres://admin:s3cretpass@db.example.com/app").text).toBe(
      `db at postgres://${REDACTED}@db.example.com/app`,
    );
    expect(redactSecrets("-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----").text).toBe(REDACTED);
    expect(redactSecrets("card 4242 4242 4242 4242 ok").text).toBe(`card ${REDACTED} ok`);
  });

  it("leaves ordinary text alone", () => {
    const text = "We chose Figma for design. Order #1234567890 shipped on 2026-11-12. Budget is $4,000.";
    expect(redactSecrets(text)).toEqual({ text, removed: 0 });
  });
});

describe("redactUrl", () => {
  it("drops credentials and token-like query parameters, keeping the rest", () => {
    expect(redactUrl("https://user:pw@app.example.com/report?id=7&token=abc&utm=x")).toEqual({
      url: "https://app.example.com/report?id=7&utm=x",
      removed: 2,
    });
    expect(redactUrl("https://example.com/docs")).toEqual({ url: "https://example.com/docs", removed: 0 });
  });
});
