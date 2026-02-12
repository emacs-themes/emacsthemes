;;; brutalist-build.el --- Brutalist theme builder -*- lexical-binding: t -*-

;; Copyright (C) 2013-2016 Marian Schubert
;; Copyright (C) 2018-2023 Gergely Nagy

;; Author: Gergely Nagy
;; Version: 0.1
;; URL: https://git.madhouse-project.org/algernon/brutalist-theme.el
;; Package-Requires: ((emacs "24.1"))

;; This program is free software; you can redistribute it and/or modify
;; it under the terms of the GNU General Public License as published by
;; the Free Software Foundation, either version 3 of the License, or
;; (at your option) any later version.

;; This program is distributed in the hope that it will be useful,
;; but WITHOUT ANY WARRANTY; without even the implied warranty of
;; MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
;; GNU General Public License for more details.

;; You should have received a copy of the GNU General Public License
;; along with this program.  If not, see <http://www.gnu.org/licenses/>.

;;; Commentary:

;; Low distraction, minimalistic color theme, with minimal colors, preferring
;; other styles of markup (italic, bold).

;;; Credits:

;; Based on:
;; http://github.com/maio/eink-emacs

;; Which in turn was inspired by:
;;
;; https://bitbucket.org/kisom/eink.vim
;; https://github.com/dmand/eink.el
;; http://www.daveliepmann.stfi.re/tufte-css/?sf=wklwy

;;; Code:

(defmacro brutalist-build-theme-with-colors (brutalist-colors &rest body)
  "Build a theme with a given set of BRUTALIST-COLORS.  Wraps BODY in a let."
  (declare (indent defun))
  `(let ,brutalist-colors
     ,@body))

(defun brutalist-build-custom-theme (theme-name)
  "Build a custom brutalist theme named THEME-NAME.

Colors are expected to specified by wrapping the call to this
function in a let."

  (custom-theme-set-faces
   theme-name

   ;; generic stuff
   `(default ((t (:background ,bg :foreground ,fg))))
   `(fringe ((t (:inherit default))))
   `(button ((t (:foreground ,fg :underline t))))
   `(cursor ((t (:background ,cursor))))
   `(custom-variable-tag ((t (:foreground ,fg :inherit bold))))
   `(default-italic ((t (:italic t :slant italic))))
   `(italic ((t (:slant italic))))
   `(error ((t (:foreground ,error :inherit bold))))
   `(warning ((t (:foreground ,warning :inherit bold))))
   `(font-latex-bold-face ((t (:foreground ,fg))))
   `(font-latex-italic-face ((t (:foreground ,fg :slant italic))))
   `(font-latex-match-reference-keywords ((t (:foreground ,fg))))
   `(font-latex-match-variable-keywords ((t (:foreground ,fg))))
   `(font-latex-string-face ((t (:foreground ,string))))
   `(font-lock-builtin-face ((t (:foreground ,fg))))
   `(font-lock-comment-face ((t (:foreground ,fg-dim))))
   `(font-lock-comment-delimiter-face ((t (:inherit font-lock-comment-face))))
   `(font-lock-constant-face ((t (:foreground ,fg :inherit bold))))
   `(font-lock-doc-face ((t (:foreground ,fg-dim :slant italic))))
   `(font-lock-function-name-face ((t (:foreground ,fg))))
   `(font-lock-keyword-face ((t (:foreground ,fg :inherit bold))))
   `(font-lock-preprocessor-face ((t (:foreground ,fg :slant italic))))
   `(font-lock-reference-face ((t (:foreground ,fg))))
   `(font-lock-string-face ((t (:foreground ,string))))
   `(font-lock-type-face ((t (:foreground ,fg :underline t))))
   `(font-lock-variable-name-face ((t (:foreground ,fg :underline nil))))
   `(font-lock-warning-face ((t (:inherit error))))
   `(fringe ((t (:background ,bg :foreground ,fg))))
   `(highlight ((t (:background ,fg-light))))
   `(lazy-highlight ((t (:background ,bg-highlight-3 :slant italic))))
   `(hl-line ((t (:inherit highlight))))
   `(ido-first-match ((t (:foreground ,fg))))
   `(ido-only-match ((t (:foreground ,fg))))
   `(ido-subdir ((t (:foreground ,fg))))
   `(isearch ((t (:background ,bg-highlight-dim :foreground ,fg))))
   `(link ((t (:foreground ,string :underline t))))
   `(minibuffer-prompt ((t (:foreground ,fg :inherit bold))))
   `(mode-line ((t (:background ,bg-light :foreground ,fg ))))
   `(mode-line-buffer ((t (:foreground ,fg :inherit bold))))
   `(mode-line-inactive ((t (:background ,bg-light :foreground ,bg-light))))
   `(mode-line-minor-mode ((t (:weight ultra-light))))
   `(modeline ((t (:background ,bg :foreground ,fg))))
   `(region ((t (:background ,bg-highlight :foreground ,fg :inverse-video nil))))
   `(slime-repl-inputed-output-face ((t (:foreground ,fg))))
   `(whitespace-line ((t (:background ,bg-highlight-2 :foreground ,fg))))

   ;; org
   `(org-agenda-date ((t (:foreground ,fg))))
   `(org-agenda-date-today ((t (:foreground ,fg :inherit bold))))
   `(org-agenda-date-weekend ((t (:foreground ,fg :weight normal))))
   `(org-agenda-structure ((t (:foreground ,fg :inherit bold))))
   `(org-block ((t (:foreground ,fg))))
   `(org-block-begin-line ((t (:foreground ,fg-dim))))
   `(org-block-end-line ((t (:foreground ,fg-dim))))
   `(org-date ((t (:foreground ,fg) :underline)))
   `(org-done ((t (:foreground ,fg-light))))
   `(org-hide ((t (:foreground ,bg))))
   `(org-verbatim ((t (:box (:line-width (1 . 1) :color ,fg :style flat-button)))))
   `(org-code ((t (:foreground ,fg :background ,bg-light :slant italic))))
   ;; use :overline to give headings more top margin
   `(org-level-1 ((t (:foreground ,fg :inherit bold))))
   `(org-level-2 ((t (:foreground ,fg :inherit bold :overline ,bg))))
   `(org-level-3 ((t (:foreground ,fg :inherit bold :overline ,bg))))
   `(org-level-4 ((t (:foreground ,fg :inherit bold :overline ,bg))))
   `(org-level-5 ((t (:foreground ,fg :inherit bold :overline ,bg))))
   `(org-level-6 ((t (:foreground ,fg :inherit bold :overline ,bg))))
   `(org-link ((t (:foreground ,fg :underline t))))
   `(org-quote ((t (:foreground ,fg :slant italic :inherit org-block))))
   `(org-scheduled ((t (:foreground ,fg))))
   `(org-sexp-date ((t (:foreground ,fg))))
   `(org-special-keyword ((t (:foreground ,fg))))
   `(org-todo ((t (:foreground ,string))))
   `(org-verse ((t (:inherit org-block :slant italic))))
   `(org-table ((t (:foreground ,fg-table))))
   `(org-checkbox ((t (:inherit bold))))
   `(org-tag ((t (:inherit bold))))

   ;; powerline
   `(powerline-active1 ((t (:background ,powerline1 :foreground ,fg-light :inherit mode-line))))
   `(powerline-active2 ((t (:background ,powerline2 :foreground ,fg-light :inherit mode-line))))

   ;; message-mode, notmuch and gnus
   `(gnus-header-content ((t (:foreground ,fg))))
   `(gnus-header-from ((t (:foreground ,fg))))
   `(gnus-header-name ((t (:foreground ,fg))))
   `(gnus-header-subject ((t (:foreground ,fg))))
   `(message-header-name ((t (:foreground ,fg :inherit bold))))
   `(message-header-other ((t (:foreground ,fg))))
   `(message-header-to ((t (:inherit message-header-other))))
   `(message-header-cc ((t (:inherit message-header-other))))
   `(message-header-subject ((t (:inherit message-header-other :foreground ,fg-table))))
   `(message-mml ((t (:box (:line-width 1 :color ,fg-slight-dim)))))
   `(message-cited-text ((t (:foreground ,fg-dim))))
   `(message-separator ((t (:foreground ,fg-slight-dim))))
   `(notmuch-message-summary-face ((t (:foreground ,fg))))
   `(notmuch-tree-match-face ((t (:foreground ,string))))
   `(notmuch-tree-match-date-face ((t (:foreground ,fg-dim))))
   `(notmuch-tree-match-author-face ((t (:foreground ,fg :inherit default))))
   `(notmuch-tree-match-tag-face ((t (:foreground ,fg-dim :weight normal))))
   `(notmuch-tree-match-tree-face ((t (:foreground ,fg-dim))))
   `(notmuch-tree-match-subject-face ((t (:foreground ,string))))
   `(notmuch-tree-no-match-face ((t (:inherit notmuch-tree-match-face :foreground ,fg-dim))))
   `(notmuch-tree-no-match-date-face ((t (:inherit notmuch-tree-match-date-face :foreground ,fg-dim))))
   `(notmuch-tree-no-match-author-face ((t (:inherit notmuch-tree-match-author-face :foreground ,fg-dim))))
   `(notmuch-tree-no-match-subject-face ((t (:inherit notmuch-tree-match-subject-face :foreground ,fg-dim))))
   `(notmuch-tree-no-match-tree-face ((t (:inherit notmuch-tree-match-tree-face :foreground ,fg-dim))))
   `(notmuch-tree-no-match-tag-face ((t (:inherit notmuch-tree-match-tag-face :foreground ,fg-dim))))
   `(notmuch-wash-toggle-button ((t (:inherit message-mml))))
   `(notmuch-tag-flagged ((t (:inherit default))))

   ;; magit
   `(magit-header ((t (:inherit bold))))
   `(magit-item-mark ((t (:background ,bg-highlight))))
   `(magit-item-highlight ((t (:weight normal))))
   `(magit-diff-context-highlight ((t (:foreground ,fg))))
   `(magit-branch-local ((t (:inherit magit-head))))
   `(magit-branch-remote ((t (:inherit magit-head))))
   `(magit-branch-current ((t (:inherit magit-head))))
   `(magit-branch-remote-head ((t (:inherit magit-head))))
   `(magit-tag ((t (:inherit magit-branch-local :underline nil))))
   `(magit-hash ((t (:inherit default :inherit bold))))
   `(magit-head ((t (:foreground ,fg-table :underline t :inherit bold))))
   `(magit-log-author ((t (:foreground ,fg-dim))))
   `(magit-section-heading ((t (:inherit bold
                                :underline t))))
   `(magit-header-line ((t nil)))
   `(magit-header-line-key ((t nil)))
   `(magit-section-highlight ((t (:fg ,fg))))
   `(magit-diff-file-heading ((t (:inherit bold))))

   `(git-commit-comment-branch ((t (:inherit magit-head))))
   `(git-commit-known-pseudo-header ((t (:inherit font-lock-keyword-face
                                         :box (:line-width 1 :color ,fg-slight-dim)))))
   `(git-commit-summary ((t (:foreground ,fg :inherit bold))))

   ;; diff
   `(diff-added ((t (:background ,diff-added))))
   `(diff-removed ((t (:background ,diff-removed))))
   `(diff-refine-added ((t (:background ,diff-added-highlight))))
   `(diff-refine-removed ((t (:background ,diff-removed-highlight))))
   `(magit-diff-added-highlight ((t (:inherit bold :background ,diff-added))))
   `(magit-diff-added ((t (:background ,diff-added))))
   `(magit-diff-removed-highlight ((t (:inherit bold :background ,diff-removed))))
   `(magit-diff-removed ((t (:background ,diff-removed))))

   ;; git-timemachine
   `(git-timemachine-minibuffer-author-face ((t (:inherit default))))
   `(git-timemachine-minibuffer-detail-face ((t (:inherit bold))))

   ;; compile
   `(compilation-error ((t (:inherit error))))

   ;; flycheck
   `(flycheck-error ((t (:inherit error))))
   `(flycheck-warning ((t (:inherit warning))))

   ;; dired
   `(dired-directory ((t (:inherit bold))))
   `(diredfl-dir-name ((t (:inherit dired-directory))))
   `(diredfl-file-name ((t nil)))
   `(diredfl-dir-heading ((t (:box (:line-width (1 . 1) :color ,fg :style flat-button)))))
   `(dired-subtree-depth-1-face ((t (:inherit default))))
   `(dired-subtree-depth-2-face ((t (:inherit default))))
   `(dired-subtree-depth-3-face ((t (:inherit default))))
   `(dired-subtree-depth-4-face ((t (:inherit default))))

   ;; helm
   `(helm-source-header ((t (:foreground ,fg :background ,bg-light :inherit bold))))
   `(helm-header ((t (:foreground ,fg))))
   `(helm-selection-line ((t (:inherit region :inherit bold))))
   `(helm-selection ((t (:inherit hl-line))))
   `(helm-ff-directory ((t (:foreground ,fg :inherit bold))))
   `(helm-ff-dotted-directory ((t (:foreground ,fg :inherit bold))))
   `(helm-ff-symlink ((t (:foreground ,fg :slant italic))))
   `(helm-ff-executable ((t (:foreground ,fg))))

   ;; iedit
   `(iedit-occurrence ((t (:background ,bg-highlight-3 :foreground ,fg))))

   ;; company
   `(company-echo-common ((t (:foreground ,fg))))
   `(company-tooltip-selection ((t (:background ,bg-highlight))))

   ;; parens - parenface
   `(parenface-paren-face ((t (:foreground ,fg-slight-dim))))
   `(parenface-curly-face ((t (:foreground ,fg-slight-dim))))
   `(parenface-bracket-face ((t (:foreground ,fg-slight-dim))))

   ;; parens - paren-face
   `(parenthesis ((t (:foreground ,fg-slight-dim))))

   ;; parens - other
   `(sp-show-pair-match-face ((t (:foreground ,paren-match :inherit bold))))
   `(sp-show-pair-mismatch-face ((t (:background ,warning :foreground ,paren-match :inherit bold))))
   `(show-paren-match ((t (:foreground ,paren-match :inherit bold))))
   `(show-paren-mismatch ((t (:background ,warning :foreground ,paren-match :inherit bold))))

   ;; sh
   `(sh-heredoc ((t (:foreground ,fg :slant italic))))
   `(sh-quoted-exec ((t (:inherit font-lock-string-face :inherit bold))))

   ;; js2
   `(js2-function-param ((t (:foreground ,fg))))
   `(js2-external-variable ((t (:foreground ,fg))))
   `(js2-jsdoc-type ((t (:inherit font-lock-type-face))))
   `(js2-jsdoc-value ((t (:inherit font-lock-variable-name-face))))
   `(js2-jsdoc-html-tag-name ((t (:inherit web-mode-html-tag-face))))

   ;; perl
   `(cperl-hash-face ((t (:foreground ,fg))))
   `(cperl-array-face ((t (:foreground ,fg))))
   `(cperl-nonoverridable-face ((t (:foreground ,fg))))

   ;; linum / nlinum-relative
   `(nlinum-relative-current-face ((t (:inherit bold))))
   `(linum ((t (:inherit bold))))

   ;; web-mode
   `(web-mode-current-element-highlight-face ((t (:inherit bold :foreground ,fg))))

   ;; markdown-mode
   `(markdown-blockquote-face ((t (:foreground ,fg-table :slant normal))))
   `(markdown-inline-code-face ((t (:slant italic))))
   `(markdown-pre-face ((t (:inherit markdown-inline-code-face))))
   `(markdown-reference-face ((t (:inherit markdown-link-face))))
   `(markdown-url-face ((t (:inherit markdown-link-face))))
   `(markdown-link-face ((t (:inherit link))))
   `(markdown-metadata-key-face ((t nil)))
   `(markdown-markup-face ((t ( :foreground ,fg-dim))))
   `(markdown-metadata-value-face ((t (:foreground ,string))))
   `(markdown-html-tag-name-face ((t (:foreground ,fg-dim))))
   `(markdown-html-attr-name-face ((t (:foreground ,fg-dim))))

   ;; Nix
   `(nix-builtin-face ((t (:underline t))))
   `(nix-attribute-face ((t (:inherit bold))))

   ;; Tree Sitter
   `(tree-sitter-hl-face:function.call ((t (:inherit font-lock-function-name-face :underline nil))))

   ;; misc
   `(idle-highlight ((t (:background ,bg-highlight))))
   `(yas-field-highlight-face ((t (:background ,bg-highlight-dim :foreground ,fg))))
   `(cider-result-overlay-face ((t (:inherit bold))))

   ;; eshell
   `(epe-dir-face ((t ( :foreground ,string))))
   `(eshell-ls-directory ((t (:inherit link))))
   `(eshell-ls-product ((t (:foreground ,fg-dim))))
   `(eshell-ls-archive ((t (:slant italic))))
   `(eshell-ls-symlink ((t (:underline t))))
   `(eshell-ls-executable ((t (:inherit bold))))
   `(eshell-prompt ((t (:foreground ,fg :inherit bold))))

   ;; evil-quickscope
   `(evil-quickscope-first-face ((t (:foreground ,fg :background ,bg-highlight-dim))))
   `(evil-quickscope-second-face ((t (:foreground ,fg :background ,bg-highlight-3))))

   ;; evil-snipe
   `(evil-snipe-first-match-face ((t (:foreground ,fg :background ,bg-highlight-dim))))
   `(evil-snipe-matches-face ((t (:foreground ,fg :background ,bg-highlight-3))))

   ;; evil-goggles
   `(evil-goggles-delete-face ((t (:inherit diff-removed))))
   `(evil-goggles-paste-face ((t (:inherit diff-added))))
   `(evil-goggles-undo-redo-add-face ((t (:inherit diff-added))))
   `(evil-goggles-undo-redo-change-face ((t (:inherit diff-changed))))
   `(evil-goggles-undo-redo-remove-face ((t (:inherit diff-removed))))
   `(evil-goggles-yank-face ((t (:inherit diff-changed))))

   ;; evil
   `(evil-ex-lazy-highlight ((t (:background ,bg-highlight-2))))
   `(evil-ex-substitute-matches ((t (:background ,diff-removed-highlight))))
   `(evil-ex-substitute-replacement ((t (:background ,diff-added-highlight :underline nil :foreground ,fg))))

   ;; auto-dim-other-buffers
   `(auto-dim-other-buffers-face ((t (:background ,bg-light))))))

(provide 'brutalist-build)

;;; brutalist-build.el ends here
