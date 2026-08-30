/**
 * Shared types for the popular-themes feature.
 *
 * Kept in `src/core` so both the fetch layer (`src/templates/popular`) and the
 * render layer (`src/templates/core/popular-themes.ts`) depend on the types
 * instead of on each other.
 */

/** Identifies one popularity source. */
export type PopularSourceId = "melpa" | "github";

/** A MELPA theme package ranked by download count. */
export interface MelpaThemeEntry {
  name: string;
  downloads: number;
  /**
   * The original external repository URL from the MELPA recipe. It feeds the
   * Source-cell link and is independent of the internal name-cell destination
   * resolved at render time.
   */
  sourceUrl?: string;
}

/** A GitHub repository ranked by star count. */
export interface GitHubThemeEntry {
  name: string; // GitHub full_name
  stars: number;
  /**
   * The canonical external repository URL. This is normally GitHub's
   * `html_url`, but points to the maintained upstream after a migration.
   */
  sourceUrl: string;
}

/**
 * The outcome of fetching one popularity source.
 *
 * A discriminated union: `status: "ok"` carries the ranked entries (plus an
 * optional warning for degraded-but-usable data), `status: "failed"` carries
 * the normalized error message.
 */
export type PopularThemeSourceResult =
  | { source: "melpa"; status: "ok"; entries: MelpaThemeEntry[]; warning?: string }
  | { source: "melpa"; status: "failed"; error: string }
  | { source: "github"; status: "ok"; entries: GitHubThemeEntry[]; warning?: string }
  | { source: "github"; status: "failed"; error: string };
