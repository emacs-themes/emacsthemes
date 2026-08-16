/**
 * Pure search and sort logic for the themes directory page.
 *
 * This module is shared between the browser script (search-script.js) and
 * unit tests.  It contains no DOM queries or side effects — those are
 * the responsibility of the caller.
 */

import { getRepositoryDisplayName } from "../../core/theme-identity";

export interface CardEntry {
  card: Element;
  id: string;
}

export interface ThemeIndexEntry {
  id: string;
  name?: string;
  searchable: string;
  screenshotGeneratedDate?: string | null;
  /** Canonical repository URL; may be absent or null in old/malformed indexes. */
  repositoryUrl?: string | null;
}

export interface ThemeIndexRecord {
  name: string;
  searchable: string;
  screenshotGeneratedDate: string | null;
  /** Canonical repository URL, or null when the entry carried none. */
  repositoryUrl: string | null;
}

export interface SortConfig {
  value: string;
  label: string;
  key: string;
  dir: "asc" | "desc";
}

export type SortComparator = (left: CardEntry, right: CardEntry) => number;

/**
 * Returns a supported sort value, falling back to the default for invalid input.
 */
export function getSortValue(
  value: string | null,
  validSortValues: string[],
  defaultSortValue: string,
): string {
  return value !== null && validSortValues.includes(value) ? value : defaultSortValue;
}

/**
 * Builds the in-memory lookup map used for O(1) metadata access by theme id.
 * Skips malformed entries and logs a warning for each.
 */
export function buildSearchMap(
  themeIndexById: Map<string, ThemeIndexRecord>,
  indexEntries: ThemeIndexEntry[],
): void {
  themeIndexById.clear();
  indexEntries.forEach((entry) => {
    if (!entry || typeof entry.id !== "string" || typeof entry.searchable !== "string") {
      console.warn("[search] Skipping malformed index entry:", entry);
      return;
    }

    themeIndexById.set(entry.id, {
      name: typeof entry.name === "string" ? entry.name : "",
      searchable: entry.searchable,
      screenshotGeneratedDate:
        typeof entry.screenshotGeneratedDate === "string" ? entry.screenshotGeneratedDate : null,
      repositoryUrl: typeof entry.repositoryUrl === "string" ? entry.repositoryUrl : null,
    });
  });
}

/**
 * Gets the display name used for alphabetical sorting.
 * Falls back to the card's `data-name` attribute when the index has no record.
 */
export function getEntryName(
  entry: CardEntry,
  themeIndexById: Map<string, ThemeIndexRecord>,
): string {
  const metadata = themeIndexById.get(entry.id);
  if (metadata && metadata.name) {
    return metadata.name;
  }

  return (entry.card as HTMLElement).getAttribute("data-name") || "";
}

/**
 * Gets the screenshot generation timestamp used for date sorting.
 * Returns null when absent or invalid.
 */
export function getEntryTimestamp(
  entry: CardEntry,
  themeIndexById: Map<string, ThemeIndexRecord>,
): number | null {
  const metadata = themeIndexById.get(entry.id);
  if (!metadata || !metadata.screenshotGeneratedDate) {
    return null;
  }

  const timestamp = Date.parse(metadata.screenshotGeneratedDate);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Compares two entries by theme name, using the "en" locale for
 * deterministic ordering across environments.
 */
export function compareEntriesByName(
  left: CardEntry,
  right: CardEntry,
  direction: "asc" | "desc",
  themeIndexById: Map<string, ThemeIndexRecord>,
): number {
  const nameComparison = getEntryName(left, themeIndexById).localeCompare(
    getEntryName(right, themeIndexById),
    "en",
  );
  if (nameComparison !== 0) {
    return direction === "desc" ? -nameComparison : nameComparison;
  }

  return left.id.localeCompare(right.id, "en");
}

/**
 * Compares two entries by screenshot generation date, with undated entries last.
 * Ties are broken by name (ascending).
 */
export function compareEntriesByDate(
  left: CardEntry,
  right: CardEntry,
  direction: "asc" | "desc",
  themeIndexById: Map<string, ThemeIndexRecord>,
): number {
  const leftTimestamp = getEntryTimestamp(left, themeIndexById);
  const rightTimestamp = getEntryTimestamp(right, themeIndexById);

  if (leftTimestamp === null && rightTimestamp === null) {
    return compareEntriesByName(left, right, "asc", themeIndexById);
  }

  if (leftTimestamp === null) return 1;
  if (rightTimestamp === null) return -1;

  const dateComparison =
    direction === "asc" ? leftTimestamp - rightTimestamp : rightTimestamp - leftTimestamp;
  return dateComparison || compareEntriesByName(left, right, "asc", themeIndexById);
}

/**
 * Reads the sort configuration from a `<select>` element's `<option>` children
 * by extracting `data-key` and `data-dir` attributes.
 */
export function parseSortConfigFromSelect(select: HTMLSelectElement | null): SortConfig[] {
  if (!select) return [];

  return Array.from(select.options).map((opt: HTMLOptionElement) => {
    const value = opt.value;
    const key = opt.getAttribute("data-key") || "";
    const rawDir = opt.getAttribute("data-dir") || "asc";
    const dir = rawDir === "desc" ? "desc" : "asc";
    return { value, label: opt.label, key, dir };
  });
}

/**
 * Builds a comparator registry from an array of sort configurations.
 * Each entry maps a sort value to its comparator function.
 */
export function buildSortComparators(
  sortConfigs: SortConfig[],
  themeIndexById: Map<string, ThemeIndexRecord>,
): Record<string, SortComparator> {
  const comparators: Record<string, SortComparator> = {};

  sortConfigs.forEach((cfg) => {
    comparators[cfg.value] = (left, right) => {
      if (cfg.key === "date") {
        return compareEntriesByDate(left, right, cfg.dir, themeIndexById);
      }
      return compareEntriesByName(left, right, cfg.dir, themeIndexById);
    };
  });

  return comparators;
}

/**
 * Options for {@link filterThemes}.
 */
export interface FilterThemesOptions {
  /** The case-insensitive text query; empty matches everything. */
  query: string;
  /** Canonical repository URL to restrict results to, or null for no repository filter. */
  repositoryUrl: string | null;
  /** Called once per card with its computed visibility. */
  onCardVisibility: (entry: CardEntry, visible: boolean) => void;
}

/**
 * Filters rendered theme cards using the precomputed searchable index.
 *
 * A card is visible only when the case-insensitive text query matches (or is
 * empty) AND the repository filter is absent or the metadata carries the exact
 * same canonical repository URL. Cards without valid index metadata never
 * match an active repository filter.
 *
 * @returns The number of visible (matching) cards after filtering.
 */
export function filterThemes(
  cardEntries: CardEntry[],
  themeIndexById: Map<string, ThemeIndexRecord>,
  options: FilterThemesOptions,
): number {
  const { query, repositoryUrl, onCardVisibility } = options;
  const q = query.toLowerCase().trim();
  let visibleCount = 0;

  cardEntries.forEach((entry) => {
    const metadata = themeIndexById.get(entry.id);
    const searchable = metadata ? metadata.searchable : "";
    const textMatches = q === "" || searchable.includes(q);
    const repoMatches =
      repositoryUrl === null ||
      (metadata !== undefined && metadata.repositoryUrl === repositoryUrl);
    const matches = textMatches && repoMatches;
    onCardVisibility(entry, matches);
    if (matches) visibleCount += 1;
  });

  return visibleCount;
}

/**
 * Builds the results headline text for the current filter state.
 *
 * The headline names the active repository so visitors and screen-reader
 * users always know what they are looking at. The sort label is used only
 * when neither a text query nor a repository filter is active (the sort
 * change announcement), so query/repository context is never dropped by a
 * sort change. Returns null when the headline should stay hidden (nothing
 * filtered and no sort announcement).
 *
 * @param {string} query - The active text query (empty when none).
 * @param {number} count - The number of visible themes.
 * @param {string | null} repositoryUrl - The active repository filter, or null.
 * @param {string} [sortLabel] - Optional sort label for the sort-change announcement.
 * @returns {string | null} The headline text, or null when no headline is needed.
 */
export function buildResultsHeadline(
  query: string,
  count: number,
  repositoryUrl: string | null,
  sortLabel?: string,
): string | null {
  if (count === 0) {
    return null;
  }
  const repoName = repositoryUrl ? ` in ${getRepositoryDisplayName(repositoryUrl)}` : "";
  if (query) {
    return `${count} ${count === 1 ? "result" : "results"} found for "${query}"${repoName}.`;
  }
  if (repositoryUrl) {
    return `${count} ${count === 1 ? "theme" : "themes"} in ${getRepositoryDisplayName(repositoryUrl)}.`;
  }
  if (sortLabel) {
    return `${sortLabel} — ${count} ${count === 1 ? "theme" : "themes"}`;
  }
  return null;
}

/**
 * Builds the no-results message for the current filter state.
 *
 * Names the active repository when one is set. A present-but-invalid
 * repository parameter is reported explicitly (fail closed) instead of
 * silently broadening the result set to the full directory.
 *
 * @param {string} query - The active text query (empty when none).
 * @param {string | null} repositoryUrl - The active repository filter value (raw when invalid).
 * @param {boolean} invalidRepository - Whether the repository parameter was present but unusable.
 * @returns {string} The no-results message.
 */
export function buildNoResultsMessage(
  query: string,
  repositoryUrl: string | null,
  invalidRepository: boolean,
): string {
  if (invalidRepository) {
    return `The repository filter "${repositoryUrl ?? ""}" is not valid.`;
  }
  const repoName = repositoryUrl ? ` in ${getRepositoryDisplayName(repositoryUrl)}` : "";
  return query
    ? `No results were found for "${query}"${repoName}.`
    : `No themes were found${repoName}.`;
}

/**
 * Reorders theme card DOM elements in-place using the given comparator.
 * Uses a DocumentFragment to batch DOM mutations.
 */
export function sortThemes(
  grid: Element,
  cardEntries: CardEntry[],
  sortComparators: Record<string, SortComparator>,
  sortValue: string,
  doc: { createDocumentFragment(): DocumentFragment } = document,
): void {
  const comparator = sortComparators[sortValue];
  if (!comparator) return;

  // eslint-disable-next-line unicorn/no-array-sort
  const sorted = [...cardEntries].sort(comparator);
  const fragment = doc.createDocumentFragment();
  sorted.forEach((entry) => fragment.appendChild(entry.card));
  grid.appendChild(fragment);
}
