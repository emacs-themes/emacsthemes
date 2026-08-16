import { describe, expect, test } from "bun:test";
import { escapeHtml, toSafeUrl } from "../src/core/html-utils";

describe("escapeHtml", () => {
  test("escapes basic HTML characters", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#039;y&#039;&gt;&amp;&lt;/a&gt;",
    );
  });

  test("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

  test("leaves plain text unchanged", () => {
    expect(escapeHtml("zenburn theme")).toBe("zenburn theme");
  });
});

describe("toSafeUrl", () => {
  test("accepts http and https URLs and normalizes them", () => {
    expect(toSafeUrl("https://github.com/owner/repo")).toBe("https://github.com/owner/repo");
    expect(toSafeUrl("http://example.com/legacy")).toBe("http://example.com/legacy");
    expect(toSafeUrl("https://example.com/?a=1#frag")).toBe("https://example.com/?a=1#frag");
  });

  test("rejects unsafe schemes, relative URLs, and malformed input", () => {
    expect(toSafeUrl("javascript:alert(1)")).toBeUndefined();
    expect(toSafeUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(toSafeUrl("file:///etc/passwd")).toBeUndefined();
    expect(toSafeUrl("/relative/path")).toBeUndefined();
    expect(toSafeUrl("owner/repo")).toBeUndefined();
    expect(toSafeUrl("not a url")).toBeUndefined();
    expect(toSafeUrl("")).toBeUndefined();
  });

  test("rejects URLs containing credentials so they never reach an href", () => {
    expect(toSafeUrl("https://user:pass@example.com/repo")).toBeUndefined();
    expect(toSafeUrl("https://user@example.com/repo")).toBeUndefined();
    expect(toSafeUrl("http://user:pass@example.com/repo")).toBeUndefined();
  });
});
