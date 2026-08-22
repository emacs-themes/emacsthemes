/**
 * Bootstraps the client-side search and sort experience for the themes directory.
 *
 * This file handles DOM interaction and event wiring. Pure search/sort logic
 * lives in src/templates/core/search-sort.ts (imported below).
 */
import {
  buildSearchMap,
  buildSortComparators,
  filterThemes,
  sortThemes,
  parseSortConfigFromSelect,
  getSortValue,
  buildResultsHeadline,
  buildNoResultsMessage,
} from "../../core/search-sort";
import {
  getRepositoryDisplayName,
  normalizeRepositoryUrl,
  REPOSITORY_URL_PARAM,
} from "../../../core/theme-identity";

(function () {
  "use strict";

  const themesIndexUrl = "{{THEMES_INDEX_URL}}";
  const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById("q"));
  const sortSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById("sort"));
  const searchForm = document.querySelector(".searchbar");
  const cards = Array.from(document.querySelectorAll(".card"));
  const resultsHeadline = document.getElementById("search-results-headline");
  const noResultsMessage = document.getElementById("no-results-message");
  const grid = document.querySelector(".grid");
  const repositoryFilter = document.getElementById("repository-filter");
  const repositoryFilterName = document.getElementById("repository-filter-name");
  const repositoryFilterClear = document.getElementById("repository-filter-clear");
  const themeIndexById = new Map();
  const cardEntries = cards
    .map((card) => {
      const id = card.getAttribute("data-id");
      if (!id) return null;
      return { card, id };
    })
    .filter(Boolean);

  // Derive sort configuration from HTML <option data-key data-dir> attributes.
  const sortConfigs = parseSortConfigFromSelect(sortSelect);
  const validSortValues = sortConfigs.map((c) => c.value);
  const defaultSortValue = sortConfigs.length > 0 ? sortConfigs[0].value : "";
  let appliedSortComparators = {};

  function buildComparators() {
    appliedSortComparators = buildSortComparators(sortConfigs, themeIndexById);
  }

  /**
   * Toggles the loading state of search controls while index data is fetched.
   */
  function setLoadingState(isLoading) {
    if (searchInput) {
      searchInput.disabled = isLoading;
    }
    if (sortSelect) {
      sortSelect.disabled = isLoading;
    }
  }

  /**
   * Validates and normalizes a sort value, falling back to default.
   */
  function getValidSortValue(value) {
    return getSortValue(value, validSortValues, defaultSortValue);
  }

  /**
   * Fetches the generated theme search index through the browser HTTP cache.
   */
  async function fetchThemesIndex() {
    const response = await window.fetch(themesIndexUrl, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error("Failed to load themes index: " + response.status);
    }

    return await response.json();
  }

  /**
   * Updates URL search parameters for the current filter, repository, and sort state.
   *
   * Writes history only when the URL actually changed. `urlMode` controls how:
   * "push" for user-initiated changes, "replace" for initial hydration of a
   * non-canonical URL (normalization must not add a duplicate history entry),
   * and "none" while restoring state from popstate (Back/Forward must never
   * be re-trapped by a re-push of the same entry).
   */
  function updateUrlState(query, sortValue, repositoryUrl, urlMode) {
    const url = new URL(window.location);

    if (query) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.delete("q");
    }

    if (repositoryUrl) {
      url.searchParams.set(REPOSITORY_URL_PARAM, repositoryUrl);
    } else {
      url.searchParams.delete(REPOSITORY_URL_PARAM);
    }

    if (sortValue === defaultSortValue) {
      url.searchParams.delete("sort");
    } else {
      url.searchParams.set("sort", sortValue);
    }

    const urlStr = url.toString();
    if (urlStr !== window.location.href) {
      if (urlMode === "push") {
        window.history.pushState({}, "", urlStr);
      } else if (urlMode === "replace") {
        window.history.replaceState({}, "", urlStr);
      }
      // "none": leave history untouched (popstate restoration).
    }
  }

  /**
   * Restores the normal results state by showing the grid and hiding no-results content.
   */
  function clearNoResultsState() {
    if (!grid || !noResultsMessage) return;
    grid.classList.remove("is-hidden");
    noResultsMessage.classList.remove("is-visible");
  }

  /**
   * Updates search result messaging and grid visibility based on the current match count.
   *
   * The repository filter is reflected in both the headline and the
   * no-results message; a repository-only landing URL exposes the active
   * filter even when the text query is empty. All text is assigned via
   * `textContent` because it derives from URL parameters.
   */
  function setResultsState(query, count, repositoryUrl, invalidRepository, sortLabel) {
    if (!grid || !noResultsMessage) return;

    if (count === 0) {
      grid.classList.add("is-hidden");
      if (resultsHeadline) {
        resultsHeadline.classList.remove("is-visible");
      }
      noResultsMessage.textContent = buildNoResultsMessage(query, repositoryUrl, invalidRepository);
      noResultsMessage.classList.add("is-visible");
      return;
    }

    clearNoResultsState();
    if (!resultsHeadline) return;
    const headline = buildResultsHeadline(query, count, repositoryUrl, sortLabel);
    if (headline === null) {
      resultsHeadline.classList.remove("is-visible");
      return;
    }
    resultsHeadline.textContent = headline;
    resultsHeadline.classList.add("is-visible");
  }

  /**
   * Shows an error state when the search index fails to load.
   */
  function showIndexError() {
    if (!noResultsMessage || !grid) return;
    grid.classList.add("is-hidden");
    noResultsMessage.textContent = "Failed to load theme data. Please refresh the page.";
    noResultsMessage.classList.add("is-visible");
    if (resultsHeadline) {
      resultsHeadline.classList.remove("is-visible");
    }
  }

  /**
   * Shows or hides the repository filter chip next to the search bar.
   */
  function updateRepositoryFilterChip(repositoryUrl) {
    if (!repositoryFilter || !repositoryFilterName) return;
    if (repositoryUrl) {
      repositoryFilterName.textContent = getRepositoryDisplayName(repositoryUrl);
      repositoryFilter.hidden = false;
    } else {
      repositoryFilter.hidden = true;
    }
  }

  // The active repository filter persists across searches and sort changes
  // so users keep searching within the matched recipe set. An invalid `repo`
  // parameter is kept as the raw value so filtering fails closed (zero
  // results) instead of silently broadening to the full directory.
  let activeRepositoryUrl = null;
  let activeRepositoryInvalid = false;

  /**
   * Applies the full search-and-sort state: filters, sorts, updates a11y and URL.
   *
   * @param {Object} state - The state to apply.
   * @param {string} state.query - The text query (empty when none).
   * @param {string} state.sortValue - The validated sort value.
   * @param {string | null} state.repositoryUrl - The active repository filter, or null.
   * @param {boolean} [state.invalidRepository] - Whether the repo param was present but unusable.
   * @param {string} [state.urlMode] - "push" | "replace" | "none" for URL history writes.
   * @param {string} [state.sortLabel] - Sort label for the sort-change announcement.
   */
  function applySearchState({
    query,
    sortValue,
    repositoryUrl,
    invalidRepository = false,
    urlMode = "push",
    sortLabel = null,
  }) {
    const visibleCount = filterThemes(cardEntries, themeIndexById, {
      query,
      repositoryUrl,
      onCardVisibility: (entry, visible) => {
        entry.card.classList.toggle("is-hidden", !visible);
      },
    });
    activeRepositoryUrl = repositoryUrl;
    activeRepositoryInvalid = invalidRepository;
    sortThemes(grid, cardEntries, appliedSortComparators, sortValue);
    setResultsState(query, visibleCount, repositoryUrl, invalidRepository, sortLabel);
    updateRepositoryFilterChip(repositoryUrl);
    updateUrlState(query, sortValue, repositoryUrl, urlMode);
  }

  /**
   * Reads and normalizes the `repo` URL parameter.
   *
   * Distinguishes "parameter absent" from "parameter present but invalid":
   * an invalid value is returned raw so the filter fails closed and the UI
   * can report it instead of silently showing the full directory.
   *
   * @param {URLSearchParams} params - The current URL parameters.
   * @returns {{ repositoryUrl: string | null, invalidRepository: boolean }} The parsed filter state.
   */
  function readRepositoryParam(params) {
    const raw = params.get(REPOSITORY_URL_PARAM);
    if (!raw) {
      return { repositoryUrl: null, invalidRepository: false };
    }
    const normalized = normalizeRepositoryUrl(raw);
    if (normalized) {
      return { repositoryUrl: normalized, invalidRepository: false };
    }
    return { repositoryUrl: raw, invalidRepository: true };
  }

  /**
   * Handles search form submission.
   */
  function handleSearch(e) {
    if (e) e.preventDefault();
    if (!searchInput) return;
    const query = searchInput.value;
    const sortValue = getValidSortValue(sortSelect ? sortSelect.value : null);
    applySearchState({
      query,
      sortValue,
      repositoryUrl: activeRepositoryUrl,
      invalidRepository: activeRepositoryInvalid,
    });
  }

  /**
   * Handles sort selection changes.
   *
   * Routes through the same state pipeline as search submission so the
   * visible/announced headline keeps the query and repository context.
   */
  function handleSortChange() {
    if (!sortSelect) return;
    const query = searchInput ? searchInput.value : "";
    const sortValue = getValidSortValue(sortSelect.value);
    const sortConfig = sortConfigs.find((c) => c.value === sortValue);
    applySearchState({
      query,
      sortValue,
      repositoryUrl: activeRepositoryUrl,
      invalidRepository: activeRepositoryInvalid,
      sortLabel: sortConfig ? sortConfig.label : sortValue,
    });
  }

  /**
   * Initializes search behavior: loads index, hydrates URL state, wires events.
   */
  async function initSearch() {
    if (!searchInput) return;

    setLoadingState(true);
    try {
      const indexEntries = await fetchThemesIndex();
      buildSearchMap(themeIndexById, indexEntries);
      buildComparators();
      setLoadingState(false);
    } catch (error) {
      console.error(error);
      setLoadingState(false);
      showIndexError();
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q") || "";
    const { repositoryUrl: initialRepositoryUrl, invalidRepository: initialInvalidRepository } =
      readRepositoryParam(params);
    const initialSortValue = getValidSortValue(params.get("sort"));
    searchInput.value = initialQuery;
    if (sortSelect) {
      sortSelect.value = initialSortValue;
    }
    applySearchState({
      query: initialQuery,
      sortValue: initialSortValue,
      repositoryUrl: initialRepositoryUrl,
      invalidRepository: initialInvalidRepository,
      urlMode: "replace",
    });

    if (repositoryFilterClear) {
      repositoryFilterClear.addEventListener("click", () => {
        const query = searchInput ? searchInput.value : "";
        const sortValue = getValidSortValue(sortSelect ? sortSelect.value : null);
        applySearchState({ query, sortValue, repositoryUrl: null });
      });
    }

    if (searchForm) {
      searchForm.addEventListener("submit", handleSearch);
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", handleSortChange);
    }

    window.addEventListener("popstate", () => {
      if (!searchInput) return;
      const nextParams = new URLSearchParams(window.location.search);
      const query = nextParams.get("q") || "";
      const { repositoryUrl, invalidRepository } = readRepositoryParam(nextParams);
      const sortValue = getValidSortValue(nextParams.get("sort"));
      searchInput.value = query;
      if (sortSelect) {
        sortSelect.value = sortValue;
      }
      applySearchState({
        query,
        sortValue,
        repositoryUrl,
        invalidRepository,
        urlMode: "none",
      });
    });
  }

  initSearch();
})();
