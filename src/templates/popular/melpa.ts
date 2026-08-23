/**
 * MELPA popularity source: download counts + recipes -> ranked theme entries.
 */
import type { MelpaThemeEntry } from "../../core/popular-types";
import { fetchJson } from "./fetch-json";

const recipesUrl = "https://melpa.org/recipes.json";
const downloadsUrl = "https://melpa.org/download_counts.json";
const THEME_NAME_PATTERN = /-theme(s)?(-|$)/;

/**
 * Repository URLs for archived packages retained in MELPA's download counts
 * after their recipe metadata was removed.
 */
const SOURCE_URL_OVERRIDES: Readonly<Record<string, string>> = {
  "color-theme-solarized": "https://github.com/sellout/emacs-color-theme-solarized",
  "darkburn-theme": "https://github.com/gorauskas/darkburn-theme",
  "eziam-theme": "https://github.com/thblt/eziam-theme-emacs",
  "farmhouse-theme": "https://github.com/mattly/emacs-farmhouse-theme",
  "majapahit-theme": "https://gitlab.com/franksn/majapahit-theme/-/tree/master?ref_type=heads",
  "omtose-phellack-theme": "https://github.com/franksn/omtose-phellack-theme",
};

/**
 * Packages omitted because they are utilities or have no resolvable theme and
 * source links for the popular page.
 */
const ignored: Record<string, true> = {
  "helm-themes": true,
  "color-theme": true,
  "company-theme-selector": true,
};

/**
 * Host name per MELPA recipe fetcher. Unknown fetchers yield no URL rather
 * than a guessed (and broken) one.
 */
const FETCHER_DOMAINS: Record<string, string> = {
  github: "github.com",
  gitlab: "gitlab.com",
  codeberg: "codeberg.org",
  savannah: "savannah.gnu.org",
  bitbucket: "bitbucket.org",
};

interface RecipeMeta {
  fetcher?: string;
  repo?: string;
  url?: string;
}

type DownloadCounts = Record<string, number>;
type RecipesIndex = Record<string, RecipeMeta>;

/**
 * Builds the external source URL for a MELPA recipe entry.
 *
 * @param {RecipeMeta | undefined} pck - The MELPA recipe metadata entry.
 * @returns {string | undefined} The fully qualified repository URL, or undefined when data is incomplete.
 */
function composeSourceUrl(pck?: RecipeMeta): string | undefined {
  if (!pck) {
    return undefined;
  }

  // If a direct URL is provided in the recipe, use it (stripping .git if present)
  if (pck.url) {
    return pck.url.replace(/\.git$/, "");
  }

  if (!pck.fetcher || !pck.repo) {
    return undefined;
  }

  if (pck.fetcher === "sourcehut") {
    return `https://git.sr.ht/~${pck.repo}`;
  }

  const domain = FETCHER_DOMAINS[pck.fetcher];
  return domain ? `https://${domain}/${pck.repo}` : undefined;
}

/**
 * Formats a package name for display by replacing hyphens with spaces.
 *
 * @param {string} name - The raw package name.
 * @returns {string} The human-friendly display name.
 */
function formatName(name: string): string {
  return name.replace(/-/g, " ");
}

/**
 * Filters and sorts theme packages by download count and enriches them with metadata.
 *
 * Retains packages whose names match the theme naming convention
 * (`-theme`/`-themes` as a word suffix, excluding the configured ignored
 * entries and slash-prefixed keys), ignores non-finite or negative download
 * counts, sorts by downloads descending with equal counts broken by package
 * name ascending, and caps the result at {@link POPULAR_THEMES_LIMIT}.
 *
 * @param {DownloadCounts} packages - Map of package names to download counts.
 * @param {RecipesIndex} recipes - Map of package names to recipe metadata.
 * @returns {MelpaThemeEntry[]} The filtered, sorted, and capped list of theme entries.
 */
export function filterPackages(
  packages: DownloadCounts,
  recipes: RecipesIndex,
  limit: number,
): MelpaThemeEntry[] {
  return Object.keys(packages)
    .filter((key) => THEME_NAME_PATTERN.test(key) && !key.startsWith("/") && !ignored[key])
    .filter((key) => {
      const count = packages[key];
      return typeof count === "number" && Number.isFinite(count) && count >= 0;
    })
    .toSorted((k1, k2) => {
      const count1 = packages[k1];
      const count2 = packages[k2];
      return count1 > count2 ? -1 : count1 < count2 ? 1 : k1.localeCompare(k2, "en");
    })
    .slice(0, limit)
    .map((k) => ({
      name: formatName(k),
      downloads: packages[k],
      sourceUrl: composeSourceUrl(recipes[k]) ?? SOURCE_URL_OVERRIDES[k],
    }));
}

/**
 * Fetches and ranks the most popular MELPA theme packages by download count.
 *
 * @param {number} limit - The maximum number of entries to keep.
 * @returns {Promise<MelpaThemeEntry[]>} The ranked theme entries.
 * @throws {Error} When MELPA data cannot be fetched or contains no qualifying packages.
 */
export async function fetchMelpaThemes(limit: number): Promise<MelpaThemeEntry[]> {
  const [packages, recipes] = await Promise.all([
    fetchJson<DownloadCounts>(downloadsUrl),
    fetchJson<RecipesIndex>(recipesUrl),
  ]);

  const themes = filterPackages(packages, recipes, limit);
  if (themes.length === 0) {
    throw new Error("MELPA returned no qualifying theme packages");
  }
  return themes;
}
