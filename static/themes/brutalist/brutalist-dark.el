;;; brutalist-dark-theme.el --- Brutalist theme, dark variant -*- lexical-binding: nil -*-

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

(deftheme brutalist-dark
  "Minimal, low-color, low-distraction theme (dark variant).")

(brutalist-build-theme-with-colors
  ((fg "#eeeee8")
   (fg-table "light blue")
   (fg-dim "gray70")
   (fg-slight-dim "dim gray")
   (bg "gray20")
   (bg-light "#888888")
   (fg-light "#ddddd8")
   (bg-highlight "grey40")
   (bg-highlight-2 "LightCyan")
   (bg-highlight-3 "DarkGreen")
   (bg-highlight-dim "sea green")

   (diff-added "#334433")
   (diff-added-highlight "#336633")
   (diff-removed "#443333")
   (diff-removed-highlight "#883333")

   (powerline1 "gray50")
   (powerline2 "gray60")

   (string "light blue")
   (cursor "white smoke")

   (error "OrangeRed")
   (warning "red")

   (paren-match "#aaccff"))

  (brutalist-build-custom-theme 'brutalist-dark))

;;;###autoload
(when load-file-name
  (add-to-list
   'custom-theme-load-path
   (file-name-as-directory (file-name-directory load-file-name))))

(provide-theme 'brutalist-dark)
(provide 'brutalist-dark-theme)

;;; brutalist-dark-theme.el ends here
