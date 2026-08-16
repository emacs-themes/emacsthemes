export const RECIPES_DIR = "recipes";
export const PINNED_THEMES_PATH = "src/templates/data/pinned-themes.json";
export const SCREENSHOT_DATES_PATH = "src/templates/data/screenshot-generated-dates.json";

/** Locale used for all deterministic date and number formatting across the site. */
export const DISPLAY_LOCALE = "en-US";

/** URL prefix for theme detail pages (e.g. `/themes/doom-one`). */
export const THEME_DETAIL_PATH_PREFIX = "/themes/";

/** URL of the themes directory page with the search UI. */
export const THEMES_INDEX_PATH = "/themes/index.html";

export interface ModeConfig {
  file: string;
  isInstructionFile?: boolean;
  sampleFile?: string;
}

export const MODE_SAMPLES: Record<string, ModeConfig> = {
  "javascript-mode": { file: "sample.js" },
  "python-mode": { file: "sample.py" },
  "c++-mode": { file: "sample.cpp" },
  "sql-mode": { file: "sample.sql" },
  "org-mode": { file: "sample.org" },
  "css-mode": { file: "sample.css" },
  "html-mode": { file: "sample.html" },
  "sh-mode": { file: "sample.sh" },
  "emacs-lisp-mode": { file: "sample.el" },
  "text-mode": { file: "sample.txt" },
  "fundamental-mode": {
    file: "fundamental-mode.el",
    isInstructionFile: true,
    sampleFile: "sample.txt",
  },
  eshell: { file: "eshell.el", isInstructionFile: true },
  term: { file: "term.el", isInstructionFile: true },
  dired: { file: "dired.el", isInstructionFile: true },
};
