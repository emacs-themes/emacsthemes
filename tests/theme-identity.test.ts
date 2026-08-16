import { describe, expect, test } from "bun:test";
import {
  getRepositoryDisplayName,
  normalizeRepositoryUrl,
  normalizeThemeIdentity,
  REPOSITORY_URL_PARAM,
} from "../src/core/theme-identity";

describe("normalizeThemeIdentity", () => {
  test("equates identities across case, spaces, punctuation, and hyphens", () => {
    expect(normalizeThemeIdentity("Doom One Theme")).toBe(normalizeThemeIdentity("doom-one-theme"));
    expect(normalizeThemeIdentity("  Zenburn  ")).toBe(normalizeThemeIdentity("zenburn"));
    expect(normalizeThemeIdentity("catppuccin_latte!")).toBe(
      normalizeThemeIdentity("Catppuccin Latte"),
    );
  });

  test("equates decomposed accents with their composed forms", () => {
    expect(normalizeThemeIdentity("máté")).toBe(normalizeThemeIdentity("mate"));
    expect(normalizeThemeIdentity("café-au-lait")).toBe(normalizeThemeIdentity("cafe au lait"));
  });

  test("collapses runs of non-alphanumeric characters into a single hyphen", () => {
    expect(normalizeThemeIdentity("a--b__c!!!d")).toBe("a-b-c-d");
    expect(normalizeThemeIdentity("  spaced   out  ")).toBe("spaced-out");
  });

  test("strips leading and trailing hyphens", () => {
    expect(normalizeThemeIdentity("--doom--")).toBe("doom");
  });

  test("returns an empty string for input with no usable identity characters", () => {
    expect(normalizeThemeIdentity("")).toBe("");
    expect(normalizeThemeIdentity("!!!")).toBe("");
    expect(normalizeThemeIdentity("---")).toBe("");
    expect(normalizeThemeIdentity("  ")).toBe("");
  });
});

describe("normalizeRepositoryUrl", () => {
  test("treats HTTP and HTTPS variants as the same HTTPS identity", () => {
    expect(normalizeRepositoryUrl("http://github.com/owner/repo")).toBe(
      "https://github.com/owner/repo",
    );
    expect(normalizeRepositoryUrl("https://github.com/owner/repo")).toBe(
      "https://github.com/owner/repo",
    );
  });

  test("lowercases hosts and paths on known case-insensitive hosts", () => {
    expect(normalizeRepositoryUrl("HTTPS://GitHub.COM/Owner/Repo")).toBe(
      "https://github.com/owner/repo",
    );
    expect(normalizeRepositoryUrl("https://GitLab.com/Owner/Repo")).toBe(
      "https://gitlab.com/owner/repo",
    );
    expect(normalizeRepositoryUrl("https://Codeberg.org/Owner/Repo")).toBe(
      "https://codeberg.org/owner/repo",
    );
    expect(normalizeRepositoryUrl("https://Bitbucket.org/Owner/Repo")).toBe(
      "https://bitbucket.org/owner/repo",
    );
  });

  test("preserves path case for unknown hosts", () => {
    expect(normalizeRepositoryUrl("https://git.example.com/Owner/Repo")).toBe(
      "https://git.example.com/Owner/Repo",
    );
  });

  test("removes trailing slashes, .git suffixes, queries, and fragments", () => {
    expect(normalizeRepositoryUrl("https://github.com/owner/repo.git")).toBe(
      "https://github.com/owner/repo",
    );
    expect(normalizeRepositoryUrl("https://github.com/owner/repo/")).toBe(
      "https://github.com/owner/repo",
    );
    expect(normalizeRepositoryUrl("https://github.com/owner/repo.git/?a=b#frag")).toBe(
      "https://github.com/owner/repo",
    );
  });

  test("distinguishes non-default ports while equating explicit default ports", () => {
    expect(normalizeRepositoryUrl("https://git.example.com:8443/owner/repo")).toBe(
      "https://git.example.com:8443/owner/repo",
    );
    expect(normalizeRepositoryUrl("https://git.example.com/owner/repo")).not.toBe(
      normalizeRepositoryUrl("https://git.example.com:8443/owner/repo"),
    );
    expect(normalizeRepositoryUrl("https://example.com:443/owner/repo")).toBe(
      "https://example.com/owner/repo",
    );
  });

  test("trims surrounding whitespace before parsing", () => {
    expect(normalizeRepositoryUrl(" https://github.com/owner/repo ")).toBe(
      "https://github.com/owner/repo",
    );
    expect(normalizeRepositoryUrl("\thttps://github.com/owner/repo\n")).toBe(
      "https://github.com/owner/repo",
    );
    expect(normalizeRepositoryUrl("  ")).toBeUndefined();
  });

  test("equates an explicit default http port with the implicit https form", () => {
    expect(normalizeRepositoryUrl("http://example.com:80/owner/repo")).toBe(
      "https://example.com/owner/repo",
    );
    expect(normalizeRepositoryUrl("http://example.com:80/owner/repo")).toBe(
      normalizeRepositoryUrl("https://example.com/owner/repo"),
    );
    // A non-default port on https is a distinct identity and must be preserved.
    expect(normalizeRepositoryUrl("https://example.com:8443/owner/repo")).toBe(
      "https://example.com:8443/owner/repo",
    );
  });

  test("rejects local, relative, malformed, credential-bearing, and unsafe-scheme URLs", () => {
    expect(normalizeRepositoryUrl("local")).toBeUndefined();
    expect(normalizeRepositoryUrl("owner/repo")).toBeUndefined();
    expect(normalizeRepositoryUrl("not a url")).toBeUndefined();
    expect(normalizeRepositoryUrl("https://user:pass@example.com/repo")).toBeUndefined();
    expect(normalizeRepositoryUrl("https://user@example.com/repo")).toBeUndefined();
    expect(normalizeRepositoryUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeRepositoryUrl("ftp://example.com/repo")).toBeUndefined();
    expect(normalizeRepositoryUrl("file:///etc/passwd")).toBeUndefined();
    expect(normalizeRepositoryUrl("")).toBeUndefined();
  });
});

describe("getRepositoryDisplayName", () => {
  test("strips the protocol from a canonical repository URL", () => {
    expect(getRepositoryDisplayName("https://github.com/owner/repo")).toBe("github.com/owner/repo");
    expect(getRepositoryDisplayName("https://git.example.com:8443/owner/repo")).toBe(
      "git.example.com:8443/owner/repo",
    );
  });

  test("returns non-URL values unchanged", () => {
    expect(getRepositoryDisplayName("not a url")).toBe("not a url");
  });
});

describe("REPOSITORY_URL_PARAM", () => {
  test("is the repo query parameter name shared by build and browser code", () => {
    expect(REPOSITORY_URL_PARAM).toBe("repo");
  });
});
