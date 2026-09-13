/**
 * Records a nonblank submitted or URL-loaded search, plus a separate zero-results event.
 * Search text is trimmed before capture. Untracked state changes and unavailable PostHog are ignored.
 * @param {Object} search - The applied search state and rendered result count.
 * @param {string} search.query - The search text.
 * @param {number} search.resultCount - Number of matching themes.
 * @param {string | null} search.repositoryUrl - Active repository filter.
 * @param {boolean} search.invalidRepository - Whether the repository filter is invalid.
 * @param {string} search.sortValue - Applied sort option.
 * @param {string | null} search.origin - "submit", "url", or null for untracked changes.
 * @returns {void}
 */
export function captureThemeSearch({
  query,
  resultCount,
  repositoryUrl,
  invalidRepository,
  sortValue,
  origin,
}) {
  const searchTerm = query.trim();
  if (!origin || !searchTerm) return;

  const properties = {
    search_term: searchTerm,
    query_length: searchTerm.length,
    result_count: resultCount,
    has_repository_filter: Boolean(repositoryUrl),
    invalid_repository_filter: invalidRepository,
    search_origin: origin,
    sort: sortValue,
  };
  window.posthog?.capture("theme_search", properties);
  if (resultCount === 0) {
    window.posthog?.capture("theme_search_no_results", properties);
  }
}
