import { DISPLAY_LOCALE, THEME_DETAIL_PATH_PREFIX, THEMES_INDEX_PATH } from "../../core/constants";
import { escapeHtml, toSafeUrl } from "../../core/html-utils";
import {
  normalizeRepositoryUrl,
  normalizeThemeIdentity,
  REPOSITORY_URL_PARAM,
} from "../../core/theme-identity";
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
  /** Label for the source column. */
  sourceLabel: string;
  /** Screen-reader caption describing the table contents. */
  caption: string;
}

/**
 * Minimal recipe data used to resolve internal destinations for popular entries.
 */
export interface PopularThemeRecipe {
  /** Recipe id used to build internal detail URLs. */
  id: string;
  /** Display name of the theme. */
  name: string;
  /** Raw repository URL from the recipe. */
  repoUrl: string;
}

/**
 * Source-agnostic entry consumed by the table renderer.
 */
interface NormalizedThemeEntry {
  name: string;
  count: number;
  /** Original external repository URL shown in the Source cell. */
  sourceUrl?: string;
  /** Resolved internal destination for the name cell, when one exists. */
  internalHref?: string;
}

/**
 * A resolved internal destination for a popular entry's name cell.
 */
type InternalDestination = { href: string } | null;

/**
 * Prebuilt recipe lookup maps used for deterministic destination resolution.
 */
interface RecipeLookups {
  /** Normalized recipe id to the candidate recipes. */
  byId: Map<string, PopularThemeRecipe[]>;
  /** Normalized recipe name to the candidate recipes. */
  byName: Map<string, PopularThemeRecipe[]>;
  /** Canonical repository URL to the candidate recipes. */
  byRepositoryUrl: Map<string, PopularThemeRecipe[]>;
}

/**
 * One reusable chain-link icon for source anchors. Inline SVG with no
 * external dependency; hidden from assistive technology because the anchor's
 * accessible name already describes the action.
 */
const SOURCE_ICON_SVG =
  '<svg class="source-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

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
    sourceLabel: "Source",
    caption: "MELPA themes ranked by total download count",
  },
  github: {
    sourceId: "github",
    heading: "GitHub",
    description: "Public Emacs Lisp theme repositories ranked by star count.",
    nameLabel: "Repository Name",
    metricLabel: "Stars",
    sourceLabel: "Source",
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
 * Appends a value to a map bucket, creating the bucket on first use.
 *
 * @param {Map<string, T[]>} map - The bucket map.
 * @param {string} key - The bucket key.
 * @param {T} value - The value to append.
 * @template T
 */
function pushBucket<T>(map: Map<string, T[]>, key: string, value: T): void {
  const bucket = map.get(key) ?? [];
  bucket.push(value);
  map.set(key, bucket);
}

/**
 * Builds the recipe lookup maps used for destination resolution.
 *
 * Indexes every recipe under its normalized id and its normalized name
 * (separate maps, so a unique id match can beat an ambiguous name match),
 * and under its canonical repository URL. All candidates are kept per key so
 * ambiguity stays explicit; recipe filesystem order is never relied upon.
 * Malformed recipes (missing or non-string `id`/`name`/`repoUrl`) are
 * skipped with a warning instead of aborting the whole build, mirroring
 * `buildSearchMap`. Recipes with `local` or invalid repository URLs are
 * skipped for repository lookups.
 *
 * @param {readonly PopularThemeRecipe[]} recipes - The recipe summaries.
 * @returns {RecipeLookups} The populated lookup maps.
 */
function buildRecipeLookups(recipes: readonly PopularThemeRecipe[]): RecipeLookups {
  const byId = new Map<string, PopularThemeRecipe[]>();
  const byName = new Map<string, PopularThemeRecipe[]>();
  const byRepositoryUrl = new Map<string, PopularThemeRecipe[]>();

  for (const recipe of recipes) {
    if (
      !recipe ||
      typeof recipe.id !== "string" ||
      typeof recipe.name !== "string" ||
      typeof recipe.repoUrl !== "string"
    ) {
      console.warn("[popular] Skipping malformed recipe:", recipe);
      continue;
    }

    const idIdentity = normalizeThemeIdentity(recipe.id);
    if (idIdentity) {
      pushBucket(byId, idIdentity, recipe);
    }
    const nameIdentity = normalizeThemeIdentity(recipe.name);
    if (nameIdentity) {
      pushBucket(byName, nameIdentity, recipe);
    }

    const repositoryUrl = normalizeRepositoryUrl(recipe.repoUrl);
    if (repositoryUrl) {
      pushBucket(byRepositoryUrl, repositoryUrl, recipe);
    }
  }

  return { byId, byName, byRepositoryUrl };
}

/**
 * Resolves the internal destination for a popular entry's name cell.
 *
 * Applies the documented precedence: an entry named after a repository that
 * contains several recipes links to the exact repository filter; otherwise a
 * unique normalized id match wins, then a unique normalized name match, then
 * a unique canonical repository match, then a repository filter for any other
 * shared repository. Ambiguous matches never select an arbitrary recipe.
 *
 * @param {string} name - The popular entry name.
 * @param {string | undefined} sourceUrl - The entry's original source repository URL.
 * @param {RecipeLookups} lookups - The prebuilt recipe lookups.
 * @returns {InternalDestination} The resolved destination.
 */
function resolveInternalDestination(
  name: string,
  sourceUrl: string | undefined,
  lookups: RecipeLookups,
): InternalDestination {
  const identity = normalizeThemeIdentity(name);
  const repositoryUrl = sourceUrl ? normalizeRepositoryUrl(sourceUrl) : undefined;
  const repoCandidates = repositoryUrl ? lookups.byRepositoryUrl.get(repositoryUrl) : undefined;

  if (identity && repositoryUrl && repoCandidates && repoCandidates.length > 1) {
    const repositoryName = new URL(repositoryUrl).pathname.split("/").filter(Boolean).at(-1) ?? "";
    if (normalizeThemeIdentity(repositoryName) === identity) {
      const params = new URLSearchParams({ [REPOSITORY_URL_PARAM]: repositoryUrl });
      return { href: `${THEMES_INDEX_PATH}?${params.toString()}` };
    }
  }

  if (identity) {
    const idCandidates = lookups.byId.get(identity);
    if (idCandidates && idCandidates.length === 1) {
      return { href: `${THEME_DETAIL_PATH_PREFIX}${idCandidates[0].id}` };
    }
    const nameCandidates = lookups.byName.get(identity);
    if (nameCandidates && nameCandidates.length === 1) {
      return { href: `${THEME_DETAIL_PATH_PREFIX}${nameCandidates[0].id}` };
    }
  }

  if (repositoryUrl && repoCandidates) {
    if (repoCandidates.length === 1) {
      return { href: `${THEME_DETAIL_PATH_PREFIX}${repoCandidates[0].id}` };
    }
    if (repoCandidates.length > 1) {
      const params = new URLSearchParams({ [REPOSITORY_URL_PARAM]: repositoryUrl });
      return { href: `${THEMES_INDEX_PATH}?${params.toString()}` };
    }
  }

  return null;
}

/**
 * Maps a source entry onto the normalized table entry shape, resolving its
 * internal destination against the recipe lookups.
 *
 * @param {MelpaThemeEntry | GitHubThemeEntry} entry - The source entry.
 * @param {RecipeLookups} lookups - The prebuilt recipe lookups.
 * @returns {NormalizedThemeEntry} The normalized entry.
 */
function toNormalizedEntry(
  entry: MelpaThemeEntry | GitHubThemeEntry,
  lookups: RecipeLookups,
): NormalizedThemeEntry {
  const destination = resolveInternalDestination(entry.name, entry.sourceUrl, lookups);
  return {
    name: entry.name,
    count: "downloads" in entry ? entry.downloads : entry.stars,
    sourceUrl: entry.sourceUrl,
    ...(destination ? { internalHref: destination.href } : {}),
  };
}

/**
 * Renders the Source cell for one entry.
 *
 * A safe `http:`/`https:` source URL becomes an icon-only external anchor
 * with `target="_blank"`, `rel="noopener noreferrer"`, and an entry-specific
 * accessible name announcing the new tab. Missing or rejected URLs render a
 * non-link unavailable marker with equivalent screen-reader text.
 *
 * @param {NormalizedThemeEntry} entry - The normalized entry.
 * @returns {string} The source cell content.
 */
function renderSourceCell(entry: NormalizedThemeEntry): string {
  const safeUrl = entry.sourceUrl ? toSafeUrl(entry.sourceUrl) : undefined;
  if (!safeUrl) {
    return `<span class="source-unavailable"><span aria-hidden="true">—</span><span class="sr-only">Source code unavailable for ${escapeHtml(entry.name)}</span></span>`;
  }
  return `<a class="source-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" title="View source code for ${escapeHtml(entry.name)}" aria-label="View source code for ${escapeHtml(entry.name)} (opens in a new tab)">${SOURCE_ICON_SVG}</a>`;
}

/**
 * Renders one accessible popularity table with a source heading and explanation.
 *
 * Emits one-based rank row headers, `scope="col"` column headers (including
 * the final Source column), a screen-reader caption, a keyboard-focusable
 * scroll region, and deterministic {@link DISPLAY_LOCALE} thousands
 * separators. Name cells link to resolved internal destinations (detail or
 * repository-filter pages) in the current tab; source cells link to the
 * original external repository in a new tab. All text and hrefs are escaped
 * at this HTML boundary.
 *
 * @param {PopularTableConfig} config - The source table configuration.
 * @param {NormalizedThemeEntry[]} entries - The ranked entries to render.
 * @returns {string} The rendered source section HTML.
 */
function renderPopularTable(config: PopularTableConfig, entries: NormalizedThemeEntry[]): string {
  const rows = entries
    .map((entry, index) => {
      const rank = index + 1;
      const nameHtml = entry.internalHref
        ? `<a href="${escapeHtml(entry.internalHref)}">${escapeHtml(entry.name)}</a>`
        : escapeHtml(entry.name);
      return `
        <tr>
          <th scope="row">${rank}</th>
          <td>${nameHtml}</td>
          <td class="text-right">${entry.count.toLocaleString(DISPLAY_LOCALE)}</td>
          <td class="source-cell">${renderSourceCell(entry)}</td>
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
            <th scope="col" class="source-cell">${escapeHtml(config.sourceLabel)}</th>
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
 * (MELPA before GitHub). Failed sources are skipped entirely. Recipe lookups
 * are built once and shared by both tables.
 *
 * @param {PopularThemeSourceResult[]} results - The per-source fetch outcomes.
 * @param {readonly PopularThemeRecipe[]} recipes - The recipe summaries used to resolve internal destinations.
 * @returns {string} The rendered source sections, or an empty string when no source succeeded.
 */
export function renderPopularThemeTables(
  results: readonly PopularThemeSourceResult[],
  recipes: readonly PopularThemeRecipe[],
): string {
  const lookups = buildRecipeLookups(recipes);
  return results
    .filter(
      (result): result is Extract<PopularThemeSourceResult, { status: "ok" }> =>
        result.status === "ok",
    )
    .map((result) =>
      renderPopularTable(
        TABLE_CONFIGS[result.source],
        result.entries.map((entry) => toNormalizedEntry(entry, lookups)),
      ),
    )
    .join("\n");
}

/**
 * Narrows full theme records to the minimal shape the popular page renderer needs.
 *
 * The narrowing is explicit so the build-time `Theme` contract cannot drift
 * silently into `PopularThemeRecipe` through structural typing: a field
 * rename surfaces here instead of at the render call site.
 *
 * @param {readonly { id: string; name: string; repoUrl: string }[]} themes - Full theme records.
 * @returns {PopularThemeRecipe[]} The narrowed recipe summaries.
 */
export function toPopularThemeRecipes(
  themes: readonly { id: string; name: string; repoUrl: string }[],
): PopularThemeRecipe[] {
  return themes.map((theme) => ({ id: theme.id, name: theme.name, repoUrl: theme.repoUrl }));
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
