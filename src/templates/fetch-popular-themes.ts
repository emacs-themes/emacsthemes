/**
 * Popular-themes CLI entry point and public module surface.
 *
 * Data fetching lives in `src/templates/popular/`; this module wires the
 * standalone CLI (`bun src/templates/fetch-popular-themes.ts`) and re-exports
 * the public API for the build and tests.
 */
import {
  fetchPopularThemes,
  writePopularThemesLogs,
  POPULAR_LOGS_DIR,
  POPULAR_THEMES_LIMIT,
} from "./popular/fetcher";
import { getErrorMessage } from "./popular/fetch-json";

export { fetchPopularThemes, writePopularThemesLogs, POPULAR_LOGS_DIR, POPULAR_THEMES_LIMIT };
export type {
  PopularThemeSourceResult,
  MelpaThemeEntry,
  GitHubThemeEntry,
} from "../core/popular-types";

if (import.meta.main) {
  fetchPopularThemes()
    .then(async (results) => {
      await writePopularThemesLogs(results, POPULAR_LOGS_DIR);
      const melpa = results.find((result) => result.source === "melpa");
      const github = results.find((result) => result.source === "github");
      if (melpa?.status !== "ok" && github?.status !== "ok") {
        console.error("Failed to fetch popular themes from both MELPA and GitHub.");
        process.exit(1);
      }
      const melpaStatus =
        melpa?.status === "ok" ? `${melpa.entries.length} MELPA themes` : "MELPA unavailable";
      const githubStatus =
        github?.status === "ok"
          ? `${github.entries.length} GitHub repositories`
          : "GitHub unavailable";
      console.log(`Successfully fetched ${melpaStatus}; ${githubStatus}.`);
    })
    .catch((error) => {
      console.error("Failed to fetch popular themes:", getErrorMessage(error));
      process.exit(1);
    });
}
