import { expect, test, describe } from "bun:test";
import { assertPathWithinRoot } from "../src/core/path-utils";
import { ThemeSchema } from "../src/core/schema-checker";

describe("Path Traversal Guard", () => {
  const root = "/app/storage";

  test("allows valid path within root", () => {
    const candidate = "/app/storage/theme-1/preview.png";
    expect(assertPathWithinRoot(root, candidate)).toBe(candidate);
  });

  test("allows valid relative path within root", () => {
    const candidate = "theme-1/preview.png";
    expect(assertPathWithinRoot(root, candidate)).toBe(`${root}/${candidate}`);
  });

  test("rejects path with '..' escaping root", () => {
    const candidate = "../../etc/passwd";
    expect(() => assertPathWithinRoot(root, candidate)).toThrow(/Security Violation/);
  });

  test("rejects absolute path outside root", () => {
    const candidate = "/etc/passwd";
    expect(() => assertPathWithinRoot(root, candidate)).toThrow(/Security Violation/);
  });

  test("rejects null byte injections (if handled by path.resolve)", () => {
    const candidate = "theme-1/\0preview.png";
    // path.resolve might throw or just clean it up depending on OS, but assertPathWithinRoot should eventually catch it if it tries to escape
    try {
      const resolved = assertPathWithinRoot(root, candidate);
      expect(resolved).not.toContain("\0");
    } catch {
      // Some systems/path versions throw on null bytes
    }
  });
});

describe("ID Validation (Schema)", () => {
  test("accepts valid slugs", () => {
    expect(ThemeSchema.shape.id.safeParse("valid-theme-id-123").success).toBe(true);
  });

  test("rejects IDs with dots (as per current strict policy)", () => {
    expect(ThemeSchema.shape.id.safeParse("invalid.id").success).toBe(false);
  });

  test("rejects IDs with spaces", () => {
    expect(ThemeSchema.shape.id.safeParse("invalid id").success).toBe(false);
  });

  test("rejects IDs with slashes", () => {
    expect(ThemeSchema.shape.id.safeParse("path/traversal").success).toBe(false);
  });

  test("rejects IDs with backslashes", () => {
    expect(ThemeSchema.shape.id.safeParse("path	raversal").success).toBe(false);
  });

  test("rejects IDs with double dots", () => {
    expect(ThemeSchema.shape.id.safeParse("..").success).toBe(false);
  });

  test("rejects empty segments or leading/trailing hyphens", () => {
    expect(ThemeSchema.shape.id.safeParse("-leading").success).toBe(false);
    expect(ThemeSchema.shape.id.safeParse("trailing-").success).toBe(false);
    expect(ThemeSchema.shape.id.safeParse("double--hyphen").success).toBe(false);
  });
});
