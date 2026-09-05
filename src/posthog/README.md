# Theme discovery analytics

[Saved funnel](https://eu.posthog.com/project/215965/insights/J4aujxrr)
(`search-funnel.json` contains its API definition).

| Event                     | Trigger                                                                                  | Properties                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `theme_search`            | Nonblank search submission or initial `q` URL landing, after results render              | `query_length`, `result_count`, `has_repository_filter`, `invalid_repository_filter`, `search_origin`, `sort` |
| `theme_search_no_results` | The same search returns zero matches                                                     | Same as `theme_search`                                                                                        |
| `theme_viewed`            | A theme detail page finishes parsing                                                     | `theme_id`                                                                                                    |
| `theme_source_clicked`    | Detail-page or popular-table source link activation, including keyboard and middle-click | `theme_id` (null on popular tables), `source_location`, `source_url`, `source_kind`                           |

Typing, blank submissions, sorting, repository-filter clearing, Back/Forward
restoration, and index-load failures do not emit search events. A zero-result
search emits both search events so it remains part of the funnel denominator.

Custom search properties omit raw query text. Existing PostHog URL properties can
still include `q`; this is not a site-wide query-redaction policy. Source URLs omit
query strings and fragments. No new person identification or storage is added.

The funnel counts unique visitors over the last 30 days, with ordered steps and a
30-minute conversion window. Its final step requires `source_location=theme_detail`.
It measures any theme, not a guaranteed search-result click or same-theme conversion;
it is not constrained to a single session. Existing project test-account filters apply.
Historical events are not backfilled.
