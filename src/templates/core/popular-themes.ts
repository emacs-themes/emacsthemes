import { DISPLAY_LOCALE } from "../../core/constants";
import { escapeHtml, toSafeUrl } from "../../core/html-utils";
import type {
  GitHubThemeEntry,
  MelpaThemeEntry,
  PopularSourceId,
  PopularThemeSourceResult,
} from "../../core/popular-types";

/**
 * Configuration describing one popularity source table.
 */
interface PopularTableConfig {
  /** Stable source identifier used for the section anchor. */
  sourceId: PopularSourceId;
  /** Source heading rendered above the table. */
  heading: string;
  /** Short explanation of how the source ranks themes. */
  description: string;
  /** Label for the name column. */
  nameLabel: string;
  /** Label for the metric column. */
  metricLabel: string;
  /** Screen-reader caption describing the table contents. */
  caption: string;
}

/**
 * Source-agnostic entry consumed by the table renderer.
 */
interface NormalizedThemeEntry {
  name: string;
  count: number;
  url?: string;
}

/**
 * Registry of table configurations keyed by source id. Adding a new
 * popularity source means adding one entry here (plus its fetch function);
 * the renderer and page copy stay untouched.
 */
const TABLE_CONFIGS: Record<PopularSourceId, PopularTableConfig> = {
  melpa: {
    sourceId: "melpa",
    heading: "MELPA",
    description:
      "The most downloaded themes from the MELPA package archive, ranked by download count.",
    nameLabel: "Theme Name",
    metricLabel: "Downloads",
    caption: "MELPA themes ranked by total download count",
  },
  github: {
    sourceId: "github",
    heading: "GitHub",
    description: "Public Emacs Lisp theme repositories ranked by star count.",
    nameLabel: "Repository Name",
    metricLabel: "Stars",
    caption: "GitHub theme repositories ranked by star count",
  },
};

/** Canonical source ordering used by copy and notice rendering. */
const SOURCE_ORDER: readonly PopularSourceId[] = ["melpa", "github"];

const SOURCE_DISPLAY_NAMES: Record<PopularSourceId, string> = {
  melpa: "MELPA",
  github: "GitHub",
};

/**
 * Maps a source entry onto the normalized table entry shape.
 *
 * @param {MelpaThemeEntry | GitHubThemeEntry} entry - The source entry.
 * @returns {NormalizedThemeEntry} The normalized entry.
 */
function toNormalizedEntry(entry: MelpaThemeEntry | GitHubThemeEntry): NormalizedThemeEntry {
  return {
    name: entry.name,
    count: "downloads" in entry ? entry.downloads : entry.stars,
    url: entry.url,
  };
}

/**
 * Renders one accessible popularity table with a source heading and explanation.
 *
 * Emits one-based rank row headers, `scope="col"` column headers, a
 * screen-reader caption, a keyboard-focusable scroll region, and deterministic
 * {@link DISPLAY_LOCALE} thousands separators. Names and links are escaped;
 * links are rendered only for safe `http:`/`https:` URLs.
 *
 * @param {PopularTableConfig} config - The source table configuration.
 * @param {NormalizedThemeEntry[]} entries - The ranked entries to render.
 * @returns {string} The rendered source section HTML.
 */
function renderPopularTable(config: PopularTableConfig, entries: NormalizedThemeEntry[]): string {
  const rows = entries
    .map((entry, index) => {
      const rank = index + 1;
      const safeUrl = entry.url ? toSafeUrl(entry.url) : undefined;
      const nameHtml = safeUrl
        ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.name)}<span class="sr-only"> (opens in a new tab)</span></a>`
        : escapeHtml(entry.name);
      return `
        <tr>
          <th scope="row">${rank}</th>
          <td>${nameHtml}</td>
          <td class="text-right">${entry.count.toLocaleString(DISPLAY_LOCALE)}</td>
        </tr>`;
    })
    .join("\n");

  return `
  <section class="popular-source" id="popular-${config.sourceId}">
    <h3>${escapeHtml(config.heading)}</h3>
    <p>${escapeHtml(config.description)}</p>
    <div class="popular-list" tabindex="0" role="region" aria-label="${escapeHtml(config.caption)}">
      <table class="themes-table">
        <caption class="sr-only">${escapeHtml(config.caption)}</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">${escapeHtml(config.nameLabel)}</th>
            <th scope="col" class="text-right">${escapeHtml(config.metricLabel)}</th>
          </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
  </section>`;
}

/**
 * Renders the popular-themes tables for the available sources.
 *
 * Renders one table per successful source result, preserving result order
 * (MELPA before GitHub). Failed sources are skipped entirely.
 *
 * @param {PopularThemeSourceResult[]} results - The per-source fetch outcomes.
 * @returns {string} The rendered source sections, or an empty string when no source succeeded.
 */
export function renderPopularThemeTables(results: readonly PopularThemeSourceResult[]): string {
  return results
    .filter(
      (result): result is Extract<PopularThemeSourceResult, { status: "ok" }> =>
        result.status === "ok",
    )
    .map((result) =>
      renderPopularTable(TABLE_CONFIGS[result.source], result.entries.map(toNormalizedEntry)),
    )
    .join("\n");
}

/**
 * Returns the source ids that succeeded, in canonical order.
 *
 * @param {readonly PopularThemeSourceResult[]} results - The per-source fetch outcomes.
 * @returns {PopularSourceId[]} The available source ids.
 */
export function getAvailablePopularSources(
  results: readonly PopularThemeSourceResult[],
): PopularSourceId[] {
  return SOURCE_ORDER.filter((source) =>
    results.some((result) => result.source === source && result.status === "ok"),
  );
}

/**
 * Returns the source ids that failed, in canonical order.
 *
 * @param {readonly PopularThemeSourceResult[]} results - The per-source fetch outcomes.
 * @returns {PopularSourceId[]} The missing source ids.
 */
export function getMissingPopularSources(
  results: readonly PopularThemeSourceResult[],
): PopularSourceId[] {
  return SOURCE_ORDER.filter((source) =>
    results.some((result) => result.source === source && result.status === "failed"),
  );
}

/**
 * Copy (title, metadata, optional subhead) for the popular page given the available sources.
 *
 * The copy names only the sources that actually rendered, so visitors and
 * social metadata are never told a ranking exists when its table is absent.
 * An empty availability set (which the build refuses to reach) falls back to
 * the full copy.
 *
 * @param {PopularSourceId[]} available - The source ids that succeeded.
 * @returns {{ title: string; description: string; ogTitle: string; ogDescription: string; subhead?: string }} The page copy.
 */
export function resolvePopularPageCopy(available: readonly PopularSourceId[]): {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  subhead?: string;
} {
  const hasMelpa = available.includes("melpa");
  const hasGithub = available.includes("github");
  const both = hasMelpa && hasGithub;

  if (both || available.length === 0) {
    return {
      title: "Popular Emacs Themes - MELPA and GitHub Rankings",
      description:
        "Discover the most downloaded Emacs themes from MELPA and the most starred Emacs theme repositories on GitHub.",
      ogTitle: "Popular Emacs Themes",
      ogDescription: "MELPA download statistics and GitHub stars for popular Emacs themes.",
    };
  }
  if (hasMelpa) {
    return {
      title: "Popular Emacs Themes - MELPA Rankings",
      description: "Discover the most downloaded Emacs themes from MELPA.",
      ogTitle: "Popular Emacs Themes",
      ogDescription: "MELPA download statistics for popular Emacs themes.",
      subhead: "The most popular Emacs themes, ranked by MELPA download counts.",
    };
  }
  return {
    title: "Popular Emacs Themes - GitHub Rankings",
    description: "Discover the most starred Emacs theme repositories on GitHub.",
    ogTitle: "Popular Emacs Themes",
    ogDescription: "GitHub stars for popular Emacs themes.",
    subhead: "The most popular Emacs themes, ranked by GitHub stars.",
  };
}

/**
 * Renders an availability notice for the missing sources, or an empty string.
 *
 * @param {PopularSourceId[]} missing - The source ids that failed.
 * @returns {string} The notice HTML, or an empty string when nothing is missing.
 */
export function renderPopularSourceNotice(missing: readonly PopularSourceId[]): string {
  if (missing.length === 0) {
    return "";
  }
  const names = SOURCE_ORDER.filter((source) => missing.includes(source)).map(
    (source) => SOURCE_DISPLAY_NAMES[source],
  );
  const joined = names.length === 2 ? `${names[0]} and ${names[1]}` : names[0];
  return `<p class="popular-notice">${joined} rankings are temporarily unavailable.</p>`;
}
