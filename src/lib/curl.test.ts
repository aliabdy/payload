import { describe, expect, it } from "vitest";
import { blankRequest } from "../store/seed";
import { parseCurl, toCurl } from "./curl";

describe("parseCurl", () => {
  it("parses a GET with headers and query parameters", () => {
    const result = parseCurl(
      "curl 'https://api.test/users?limit=5' -H 'Accept: application/json' -k -L",
    );
    expect(result.error).toBeNull();
    expect(result.parsed?.method).toBe("GET");
    expect(result.parsed?.url).toBe("https://api.test/users?limit=5");
    expect(result.parsed?.headers).toMatchObject([
      { key: "Accept", value: "application/json" },
    ]);
    expect(result.parsed?.options.verifyTls).toBe(false);
    expect(result.parsed?.options.followRedirects).toBe(true);
  });

  it("parses JSON bodies, basic auth and continuations", () => {
    const result = parseCurl(
      "curl --request POST https://api.test/users \\\n  -u alice:secret \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{\"name\":\"Ada\"}'",
    );
    expect(result.error).toBeNull();
    expect(result.parsed?.method).toBe("POST");
    expect(result.parsed?.body.mode).toBe("json");
    expect(result.parsed?.body.content).toBe('{"name":"Ada"}');
    expect(result.parsed?.auth).toMatchObject({
      type: "basic",
      username: "alice",
      password: "secret",
    });
  });

  it("rejects multipart uploads", () => {
    const result = parseCurl("curl https://api.test -F file=@photo.png");
    expect(result.parsed).toBeNull();
    expect(result.error).toMatch(/multipart/i);
  });
});

describe("toCurl", () => {
  it("exports headers, bodies and security options", () => {
    const request = blankRequest({
      method: "PATCH",
      url: "https://api.test/users",
      headers: [{ id: "h", enabled: true, key: "X-Test", value: "1" }],
      body: { mode: "json", content: '{"ok":true}', fields: [] },
      options: { timeoutMs: 5000, followRedirects: false, verifyTls: false },
    });
    const curl = toCurl(request);
    expect(curl).toContain("--request PATCH");
    expect(curl).toContain("--header 'X-Test: 1'");
    expect(curl).toContain(`--data-raw '{"ok":true}'`);
    expect(curl).toContain("--insecure");
    expect(curl).toContain("--max-time 5");
  });
});
