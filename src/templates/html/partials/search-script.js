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
} from "../../core/search-sort";

(function () {
  "use strict";

  const themesIndexUrl = "{{THEMES_INDEX_URL}}";
  const themesIndexCacheKey = `emacsthemes:index:v2:${themesIndexUrl}`;
  const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById("q"));
  const sortSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById("sort"));
  const searchForm = document.querySelector(".searchbar");
  const cards = Array.from(document.querySelectorAll(".card"));
  const resultsHeadline = document.getElementById("search-results-headline");
  const noResultsMessage = document.getElementById("no-results-message");
  const grid = document.querySelector(".grid");
  const canonicalLink = document.querySelector('link[rel="canonical"]');
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

  // Clean up stale pre-v2 sessionStorage keys on first load.
  try {
    const oldPrefix = "emacsthemes:index:";
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(oldPrefix) && !key.includes(":v2:")) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // sessionStorage may be unavailable — silently skip cleanup.
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
   * Loads the theme search index from sessionStorage or network, then caches it.
   */
  async function fetchThemesIndex() {
    const cached = window.sessionStorage.getItem(themesIndexCacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        window.sessionStorage.removeItem(themesIndexCacheKey);
      }
    }

    const response = await window.fetch(themesIndexUrl, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error("Failed to load themes index: " + response.status);
    }

    const indexEntries = await response.json();
    window.sessionStorage.setItem(themesIndexCacheKey, JSON.stringify(indexEntries));
    return indexEntries;
  }

  /**
   * Updates URL search parameters for the current filter and sort state.
   * Uses replaceState when the URL hasn't changed to avoid polluting history.
   */
  function updateUrlState(query, sortValue) {
    const url = new URL(window.location);

    if (query) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.delete("q");
    }

    if (sortValue === defaultSortValue) {
      url.searchParams.delete("sort");
    } else {
      url.searchParams.set("sort", sortValue);
    }

    const urlStr = url.toString();
    if (urlStr !== window.location.href) {
      window.history.pushState({}, "", urlStr);
    }
    updateCanonicalUrl(urlStr);
  }

  /**
   * Updates the canonical link to reflect the current URL after query changes.
   */
  function updateCanonicalUrl(url) {
    if (!canonicalLink) return;
    canonicalLink.setAttribute("href", url || window.location.href);
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
   * Announces a message to screen readers via the results headline live region.
   */
  function announceSortChange(sortValue, count) {
    if (!resultsHeadline) return;
    const cfg = sortConfigs.find((c) => c.value === sortValue);
    const label = cfg ? cfg.label : sortValue;
    resultsHeadline.textContent = `${label} — ${count} theme${count !== 1 ? "s" : ""}`;
    if (count > 0) {
      resultsHeadline.classList.add("is-visible");
    }
  }

  /**
   * Updates search result messaging and grid visibility based on the current match count.
   */
  function setResultsState(query, count) {
    if (!grid || !noResultsMessage) return;

    if (count === 0) {
      grid.classList.add("is-hidden");
      if (resultsHeadline) {
        resultsHeadline.classList.remove("is-visible");
      }
      noResultsMessage.textContent = 'No results were found for "' + query + '".';
      noResultsMessage.classList.add("is-visible");
      return;
    }

    clearNoResultsState();
    if (!resultsHeadline) return;
    if (!query) {
      resultsHeadline.classList.remove("is-visible");
      return;
    }
    const suffix = count === 1 ? "result" : "results";
    resultsHeadline.textContent = count + " " + suffix + ' found for "' + query + '".';
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
   * Applies the full search-and-sort state: filters, sorts, updates a11y and URL.
   */
  function applySearchState(query, sortValue) {
    const visibleCount = filterThemes(cardEntries, themeIndexById, query, (entry, visible) => {
      entry.card.classList.toggle("is-hidden", !visible);
    });
    sortThemes(grid, cardEntries, appliedSortComparators, sortValue);
    setResultsState(query, visibleCount);
    updateUrlState(query, sortValue);
  }

  /**
   * Handles search form submission.
   */
  function handleSearch(e) {
    if (e) e.preventDefault();
    if (!searchInput) return;
    const query = searchInput.value;
    const sortValue = getValidSortValue(sortSelect ? sortSelect.value : null);
    applySearchState(query, sortValue);
  }

  /**
   * Handles sort selection changes.
   */
  function handleSortChange() {
    if (!sortSelect) return;
    const query = searchInput ? searchInput.value : "";
    const sortValue = getValidSortValue(sortSelect.value);
    const visibleCount = filterThemes(cardEntries, themeIndexById, query, (entry, visible) => {
      entry.card.classList.toggle("is-hidden", !visible);
    });
    sortThemes(grid, cardEntries, appliedSortComparators, sortValue);
    announceSortChange(sortValue, visibleCount);
    updateUrlState(query, sortValue);
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
    const initialSortValue = getValidSortValue(params.get("sort"));
    searchInput.value = initialQuery;
    if (sortSelect) {
      sortSelect.value = initialSortValue;
    }
    applySearchState(initialQuery, initialSortValue);

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
      const sortValue = getValidSortValue(nextParams.get("sort"));
      searchInput.value = query;
      if (sortSelect) {
        sortSelect.value = sortValue;
      }
      applySearchState(query, sortValue);
    });
  }

  initSearch();
})();
