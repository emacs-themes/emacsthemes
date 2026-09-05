/**
 * Records a nonblank submitted or URL-loaded search, plus a separate zero-results event.
 * Raw query text is omitted. Untracked state changes and unavailable PostHog are ignored.
 * @param {Object} search - The applied search state and rendered result count.
 * @param {string} search.query - The search text, used only for its trimmed length.
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
  if (!origin || !query.trim()) return;

  const properties = {
    query_length: query.trim().length,
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
