import { expect, test, describe } from "bun:test";
import { validateRecipeStrict } from "../src/core/schema-checker";
import { escapeHtml } from "../src/core/html-utils";

describe("Strict Validator (Injection Safety)", () => {
  const baseRecipe = {
    name: "Safe Theme",
    id: "safe-theme",
    description: "A very safe theme",
    repoUrl: "https://github.com/example/safe",
    rawUrls: ["https://github.com/example/safe/raw/main/safe.el"],
    type: "dark",
    authors: ["John Doe"],
    tags: ["safe", "clean"],
  };

  test("accepts a clean recipe", () => {
    const result = validateRecipeStrict(baseRecipe);
    expect(result.success).toBe(true);
  });

  test("rejects script tags in description", () => {
    const malicious = { ...baseRecipe, description: "Safe <script>alert(1)</script>" };
    const result = validateRecipeStrict(malicious);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("contains a script tag"))).toBe(true);
    }
  });

  test("rejects HTML tags in name", () => {
    const malicious = { ...baseRecipe, name: "<b>Bold</b> Theme" };
    const result = validateRecipeStrict(malicious);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("contains HTML-like tags"))).toBe(true);
    }
  });

  test("rejects event handlers", () => {
    const malicious = { ...baseRecipe, description: 'Safe theme" onmouseover="alert(1)' };
    const result = validateRecipeStrict(malicious);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("contains inline event handler syntax"))).toBe(
        true,
      );
    }
  });

  test("rejects javascript: URLs", () => {
    const malicious = { ...baseRecipe, repoUrl: "javascript:alert(1)" };
    const result = validateRecipeStrict(malicious);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("must use http, https protocol"))).toBe(true);
    }
  });

  test("rejects unsafe content in tags", () => {
    const malicious = { ...baseRecipe, tags: ["safe", "<img src=x onerror=alert(1)>"] };
    const result = validateRecipeStrict(malicious);
    expect(result.success).toBe(false);
  });

  test("rejects unsafe content in authors", () => {
    const malicious = { ...baseRecipe, authors: ["John Doe <jdoe@example.com>"] };
    // Currently < > are caught by HTML-like tags pattern
    const result = validateRecipeStrict(malicious);
    expect(result.success).toBe(false);
  });
});

describe("Strict Validator (Source-link contract)", () => {
  const baseRecipe = {
    name: "Local Theme",
    id: "safe-theme",
    description: "A local theme",
    repoUrl: "local",
    rawUrls: ["static/themes/safe-theme/safe-theme.el"],
    type: "dark",
    authors: ["Jane Doe"],
    tags: ["local"],
  };

  test("accepts a local theme with safe rawUrls", () => {
    expect(validateRecipeStrict(baseRecipe).success).toBe(true);
  });

  test.each([
    "static/themes/safe-theme/../evil.el",
    "static/themes/safe-theme/./evil.el",
    "static/themes/safe-theme//evil.el",
    "static\\themes\\safe-theme\\evil.el",
    "https://example.com/evil.el",
  ])("rejects unsafe local source path %s", (rawUrl) => {
    const result = validateRecipeStrict({ ...baseRecipe, rawUrls: [rawUrl] });
    expect(result.success).toBe(false);
  });

  test("rejects a local rawUrls entry without a file below the theme folder", () => {
    const result = validateRecipeStrict({ ...baseRecipe, rawUrls: ["static/themes/safe-theme"] });
    expect(result.success).toBe(false);
  });

  test("rejects credential-bearing repository URLs", () => {
    const result = validateRecipeStrict({
      ...baseRecipe,
      repoUrl: "https://user:pass@github.com/example/safe",
      rawUrls: ["https://github.com/example/safe/raw/main/safe.el"],
    });
    expect(result.success).toBe(false);
  });

  test("rejects credential-bearing rawUrls", () => {
    const result = validateRecipeStrict({
      ...baseRecipe,
      repoUrl: "https://github.com/example/safe",
      rawUrls: ["https://user:pass@github.com/example/safe/raw/main/safe.el"],
    });
    expect(result.success).toBe(false);
  });
});

describe("HTML Escaping", () => {
  test("escapes basic HTML characters", () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("John's Theme & Co")).toBe("John&#039;s Theme &amp; Co");
  });

  test("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
});
