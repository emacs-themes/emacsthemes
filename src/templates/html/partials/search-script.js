/**
 * Bootstraps the client-side search experience for the themes directory page.
 *
 * Responsibilities:
 * - Load and cache the generated theme search and sorting index.
 * - Keep URL query parameter state in sync with the current search and sort order.
 * - Filter visible cards, sort them, and update result/no-result UI states.
 */
(function () {
  const themesIndexUrl = "{{THEMES_INDEX_URL}}";
  const themesIndexCacheKey = `emacsthemes:index:v2:${themesIndexUrl}`;
  const defaultSortValue = "name-asc";
  const validSortValues = ["name-asc", "name-desc", "date-asc", "date-desc"];
  const searchInput = document.getElementById("q");
  const sortSelect = document.getElementById("sort");
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

  /**
   * Toggles the loading state of search controls while index data is fetched.
   *
   * @param {boolean} isLoading - Whether the search UI should be marked busy.
   */
  function setLoadingState(isLoading) {
    if (searchInput) {
      searchInput.disabled = isLoading;
      searchInput.setAttribute("aria-busy", isLoading ? "true" : "false");
    }

    if (sortSelect) {
      sortSelect.disabled = isLoading;
      sortSelect.setAttribute("aria-busy", isLoading ? "true" : "false");
    }
  }

  /**
   * Returns a supported sort value, falling back to the default for invalid input.
   *
   * @param {string | null} value - Candidate sort value from the UI or URL.
   * @returns {string} Safe sort value.
   */
  function getSortValue(value) {
    return validSortValues.includes(value) ? value : defaultSortValue;
  }

  /**
   * Builds the in-memory lookup map used for O(1) metadata access by theme id.
   *
   * @param {Array<{id: string, name?: string, searchable: string, screenshotGeneratedDate?: string | null}>} indexEntries - Parsed index records.
   */
  function buildSearchMap(indexEntries) {
    themeIndexById.clear();
    indexEntries.forEach((entry) => {
      if (!entry || typeof entry.id !== "string" || typeof entry.searchable !== "string") {
        return;
      }

      themeIndexById.set(entry.id, {
        name: typeof entry.name === "string" ? entry.name : "",
        searchable: entry.searchable,
        screenshotGeneratedDate:
          typeof entry.screenshotGeneratedDate === "string" ? entry.screenshotGeneratedDate : null,
      });
    });
  }

  /**
   * Loads the theme search index from sessionStorage or network, then caches it.
   *
   * @returns {Promise<Array<{id: string, name?: string, searchable: string, screenshotGeneratedDate?: string | null}>>} Resolved search index entries.
   * @throws {Error} When the network request fails with a non-success status.
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
      throw new Error(`Failed to load themes index: ${response.status}`);
    }

    const indexEntries = await response.json();
    window.sessionStorage.setItem(themesIndexCacheKey, JSON.stringify(indexEntries));
    return indexEntries;
  }

  /**
   * Updates the canonical link to reflect the current URL after query changes.
   */
  function updateCanonicalUrl() {
    if (!canonicalLink) return;
    canonicalLink.setAttribute("href", window.location.href);
  }

  /**
   * Updates URL search parameters for the current filter and sort state.
   *
   * @param {string} query - Raw user query string.
   * @param {string} sortValue - Active sort value.
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

    window.history.pushState({}, "", url);
    updateCanonicalUrl();
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
   * @param {string} query - Raw user query string.
   * @param {number} count - Number of cards currently visible after filtering.
   */
  function setResultsState(query, count) {
    if (!grid || !noResultsMessage) return;

    if (count === 0) {
      grid.classList.add("is-hidden");
      if (resultsHeadline) {
        resultsHeadline.classList.remove("is-visible");
      }
      noResultsMessage.textContent = `No results were found for "${query}".`;
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
    resultsHeadline.textContent = `${count} ${suffix} found for "${query}".`;
    resultsHeadline.classList.add("is-visible");
  }

  /**
   * Gets the display name used for alphabetical sorting.
   *
   * @param {{card: Element, id: string}} entry - Rendered card entry.
   * @returns {string} Theme name.
   */
  function getEntryName(entry) {
    const metadata = themeIndexById.get(entry.id);
    if (metadata && metadata.name) {
      return metadata.name;
    }

    return entry.card.getAttribute("data-name") || "";
  }

  /**
   * Gets the screenshot generation timestamp used for date sorting.
   *
   * @param {{id: string}} entry - Rendered card entry.
   * @returns {number | null} Millisecond timestamp, or null when absent/invalid.
   */
  function getEntryTimestamp(entry) {
    const metadata = themeIndexById.get(entry.id);
    if (!metadata || !metadata.screenshotGeneratedDate) {
      return null;
    }

    const timestamp = Date.parse(metadata.screenshotGeneratedDate);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  /**
   * Compares two entries by theme name.
   *
   * @param {{card: Element, id: string}} left - Left card entry.
   * @param {{card: Element, id: string}} right - Right card entry.
   * @param {"asc" | "desc"} direction - Sort direction.
   * @returns {number} Sort comparison result.
   */
  function compareEntriesByName(left, right, direction) {
    const nameComparison = getEntryName(left).localeCompare(getEntryName(right));
    if (nameComparison !== 0) {
      return direction === "desc" ? -nameComparison : nameComparison;
    }

    return left.id.localeCompare(right.id);
  }

  /**
   * Compares two entries by screenshot generation date, with undated entries last.
   *
   * @param {{card: Element, id: string}} left - Left card entry.
   * @param {{card: Element, id: string}} right - Right card entry.
   * @param {"asc" | "desc"} direction - Sort direction.
   * @returns {number} Sort comparison result.
   */
  function compareEntriesByDate(left, right, direction) {
    const leftTimestamp = getEntryTimestamp(left);
    const rightTimestamp = getEntryTimestamp(right);

    if (leftTimestamp === null && rightTimestamp === null) {
      return compareEntriesByName(left, right, "asc");
    }

    if (leftTimestamp === null) return 1;
    if (rightTimestamp === null) return -1;

    const dateComparison =
      direction === "asc" ? leftTimestamp - rightTimestamp : rightTimestamp - leftTimestamp;
    return dateComparison || compareEntriesByName(left, right, "asc");
  }

  /**
   * Sorts rendered theme cards in the selected order.
   *
   * @param {string} sortValue - Active sort value.
   */
  function sortThemes(sortValue) {
    if (!grid) return;

    const sortedEntries = cardEntries.toSorted((left, right) => {
      switch (sortValue) {
        case "name-desc":
          return compareEntriesByName(left, right, "desc");
        case "date-asc":
          return compareEntriesByDate(left, right, "asc");
        case "date-desc":
          return compareEntriesByDate(left, right, "desc");
        default:
          return compareEntriesByName(left, right, "asc");
      }
    });

    sortedEntries.forEach((entry) => grid.appendChild(entry.card));
  }

  /**
   * Filters rendered theme cards using the precomputed searchable index.
   *
   * @param {string} query - User-entered search query.
   */
  function filterThemes(query) {
    const q = query.toLowerCase().trim();
    let visibleCount = 0;

    cardEntries.forEach((entry) => {
      const metadata = themeIndexById.get(entry.id);
      const searchable = metadata ? metadata.searchable : "";
      const matches = q === "" || searchable.includes(q);
      entry.card.classList.toggle("is-hidden", !matches);
      if (matches) visibleCount += 1;
    });

    setResultsState(query.trim(), visibleCount);
  }

  /**
   * Handles search form submission: keeps URL state in sync and applies filtering.
   *
   * @param {Event} [e] - Optional submit event.
   */
  function handleSearch(e) {
    if (e) e.preventDefault();
    const query = searchInput.value;
    const sortValue = getSortValue(sortSelect ? sortSelect.value : null);

    filterThemes(query);
    sortThemes(sortValue);
    updateUrlState(query, sortValue);
  }

  /**
   * Handles sort selection changes by reordering the filtered cards.
   */
  function handleSortChange() {
    const query = searchInput ? searchInput.value : "";
    const sortValue = getSortValue(sortSelect ? sortSelect.value : null);

    if (sortSelect) {
      sortSelect.value = sortValue;
    }

    filterThemes(query);
    sortThemes(sortValue);
    updateUrlState(query, sortValue);
  }

  /**
   * Initializes search behavior by loading index data, hydrating initial query/sort state,
   * and wiring submit/sort/history event listeners.
   *
   * @returns {Promise<void>} Resolves once startup logic has completed.
   */
  async function initSearch() {
    if (!searchInput) return;

    setLoadingState(true);
    try {
      const indexEntries = await fetchThemesIndex();
      buildSearchMap(indexEntries);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingState(false);
    }

    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q") || "";
    const initialSortValue = getSortValue(params.get("sort"));
    searchInput.value = initialQuery;
    if (sortSelect) {
      sortSelect.value = initialSortValue;
    }
    filterThemes(initialQuery);
    sortThemes(initialSortValue);
    updateCanonicalUrl();

    if (searchForm) {
      searchForm.addEventListener("submit", handleSearch);
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", handleSortChange);
    }

    window.addEventListener("popstate", () => {
      const nextParams = new URLSearchParams(window.location.search);
      const query = nextParams.get("q") || "";
      const sortValue = getSortValue(nextParams.get("sort"));
      searchInput.value = query;
      if (sortSelect) {
        sortSelect.value = sortValue;
      }
      filterThemes(query);
      sortThemes(sortValue);
      updateCanonicalUrl();
    });
  }

  initSearch();
})();
