export const RECIPES_DIR = "recipes";

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
