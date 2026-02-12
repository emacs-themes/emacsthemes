;;; brutalist-theme.el --- Brutalist theme -*- lexical-binding: nil -*-

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

(require 'brutalist-build)

(deftheme brutalist
  "Minimal, low-color, low-distraction theme (light variant).")

(brutalist-build-theme-with-colors
  ((fg "#111111")
   (fg-table "#222291")
   (fg-dim "dim gray")
   (fg-slight-dim "grey70")
   (bg "#fffff8")
   (bg-light "#ddddd8")
   (fg-light "#ddddd8")
   (bg-highlight "#FFF1AA")
   (bg-highlight-2 "LightCyan")
   (bg-highlight-3 "LightGreen")
   (bg-highlight-dim "#eeeee8")

   (diff-added "#e9ffe9")
   (diff-added-highlight "#a4f4a3")
   (diff-removed "#ffecec")
   (diff-removed-highlight "#f9cbca")

   (powerline1 "grey22")
   (powerline2 "grey40")

   (string "blue")
   (cursor "#111111")

   (error "OrangeRed")
   (warning "DarkOrange")

   (paren-match "blue"))

  (brutalist-build-custom-theme 'brutalist))

;;;###autoload
(when load-file-name
  (add-to-list
   'custom-theme-load-path
   (file-name-as-directory (file-name-directory load-file-name))))

(provide-theme 'brutalist)
(provide 'brutalist-theme)

;;; brutalist-theme.el ends here
