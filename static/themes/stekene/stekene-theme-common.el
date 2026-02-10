;;; stekene-theme-common.el --- Common stuff for the stekene themes -*- lexical-binding: t -*-

;; Author: Fanael Linithien &lt;fanael4@gmail.com&gt;
;; URL: https://github.com/Fanael/stekene-theme

;; This file is NOT part of GNU Emacs.

;; Copyright (c) 2014, Fanael Linithien
;; All rights reserved.
;;
;; Redistribution and use in source and binary forms, with or without
;; modification, are permitted provided that the following conditions are
;; met:
;;
;;   * Redistributions of source code must retain the above copyright
;;     notice, this list of conditions and the following disclaimer.
;;   * Redistributions in binary form must reproduce the above copyright
;;     notice, this list of conditions and the following disclaimer in the
;;     documentation and/or other materials provided with the distribution.
;;   * Neither the name of the copyright holder(s) nor the names of any
;;     contributors may be used to endorse or promote products derived from
;;     this software without specific prior written permission.
;;
;; THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
;; IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
;; TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
;; PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER
;; OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
;; EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
;; PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
;; PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
;; LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
;; NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
;; SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

;;; Code:

(defmacro stekene-theme--set-faces (name palette)
  `(let ,(cons '(class '((class color) (min-colors 89))) palette)
     (custom-theme-set-faces
      ',name
      `(default ((,class (:background ,background :foreground ,foreground))))
      `(cursor ((,class (:background ,foreground))))
      `(region ((,class (:background ,region))))
      `(highlight ((,class (:background ,highlight))))
      `(font-lock-builtin-face ((,class (:foreground ,blue3))))
      `(font-lock-preprocessor-face ((,class (:foreground ,dullred))))
      `(font-lock-comment-face ((,class (:foreground ,gray1))))
      `(font-lock-constant-face ((,class (:foreground ,dullyellow))))
      `(font-lock-function-name-face ((,class (:foreground ,blue1))))
      `(font-lock-keyword-face ((,class (:foreground ,gray2))))
      `(font-lock-string-face ((,class (:foreground ,red))))
      `(font-lock-regexp-grouping-backslash ((,class (:foreground ,orange2))))
      `(font-lock-regexp-grouping-construct ((,class (:foreground ,yellow2))))
      `(font-lock-doc-face ((,class (:foreground ,orange1))))
      `(font-lock-type-face ((,class (:foreground ,dullgreen))))
      `(font-lock-variable-name-face ((,class (:foreground ,blue2))))
      `(font-lock-negation-char-face ((,class (:foreground ,orange2))))

      `(hl-line ((,class (:background ,hlline))))
      `(show-paren-match-face ((,class (:background ,region))))

      `(whitespace-line ((,class (:background ,whitespaceline :foreground nil))))
      `(whitespace-trailing ((,class (:background ,whitespacetrailing :foreground nil))))

      `(fringe ((,class (:background ,fringebg))))
      `(linum ((,class (:background ,background :foreground ,gray1))))

      `(mode-line ((,class
                    (:background ,modelinebg :foreground ,foreground :box nil))))

      `(minibuffer-prompt ((,class (:foreground ,orange1))))

      `(ido-subdir ((,class (:foreground ,yellow1))))
      `(ido-only-match ((,class (:foreground ,blue2))))

      `(evil-ex-info ((,class (:foreground ,red :weight bold))))
      `(evil-ex-substitute-replacement ((,class
                                         (:foreground ,red :weight bold :underline t))))

      `(rainbow-identifiers-identifier-1 ((,class (:foreground ,symbol1))))
      `(rainbow-identifiers-identifier-2 ((,class (:foreground ,symbol2))))
      `(rainbow-identifiers-identifier-3 ((,class (:foreground ,symbol3))))
      `(rainbow-identifiers-identifier-4 ((,class (:foreground ,symbol4))))
      `(rainbow-identifiers-identifier-5 ((,class (:foreground ,symbol5))))
      `(rainbow-identifiers-identifier-6 ((,class (:foreground ,symbol6))))
      `(rainbow-identifiers-identifier-7 ((,class (:foreground ,symbol7))))
      `(rainbow-identifiers-identifier-8 ((,class (:foreground ,symbol8))))
      `(rainbow-identifiers-identifier-9 ((,class (:foreground ,symbol9))))
      `(rainbow-identifiers-identifier-10 ((,class (:foreground ,symbol10))))
      `(rainbow-identifiers-identifier-11 ((,class (:foreground ,symbol11))))
      `(rainbow-identifiers-identifier-12 ((,class (:foreground ,symbol12))))
      `(rainbow-identifiers-identifier-13 ((,class (:foreground ,symbol13))))
      `(rainbow-identifiers-identifier-14 ((,class (:foreground ,symbol14))))
      `(rainbow-identifiers-identifier-15 ((,class (:foreground ,symbol15))))

      `(rainbow-delimiters-depth-1-face ((,class (:foreground ,delim1))))
      `(rainbow-delimiters-depth-2-face ((,class (:foreground ,delim2))))
      `(rainbow-delimiters-depth-3-face ((,class (:foreground ,delim3))))
      `(rainbow-delimiters-depth-4-face ((,class (:foreground ,delim4))))
      `(rainbow-delimiters-depth-5-face ((,class (:foreground ,delim5))))
      `(rainbow-delimiters-depth-6-face ((,class (:foreground ,delim6))))
      `(rainbow-delimiters-depth-7-face ((,class (:foreground ,delim7))))
      `(rainbow-delimiters-depth-8-face ((,class (:foreground ,delim8))))
      `(rainbow-delimiters-depth-9-face ((,class (:foreground ,delim9))))

      `(highlight-blocks-depth-1-face ((,class (:background ,block1))))
      `(highlight-blocks-depth-2-face ((,class (:background ,block2))))
      `(highlight-blocks-depth-3-face ((,class (:background ,block3))))
      `(highlight-blocks-depth-4-face ((,class (:background ,block4))))
      `(highlight-blocks-depth-5-face ((,class (:background ,block5))))
      `(highlight-blocks-depth-6-face ((,class (:background ,block6))))
      `(highlight-blocks-depth-7-face ((,class (:background ,block7))))
      `(highlight-blocks-depth-8-face ((,class (:background ,block8))))
      `(highlight-blocks-depth-9-face ((,class (:background ,block9)))))
     (custom-theme-set-variables
      ',name
      `(rainbow-identifiers-cie-l*a*b*-lightness ,delimlightness)
      `(rainbow-identifiers-cie-l*a*b*-saturation ,delimsaturation))))

;;;###autoload
(when load-file-name
  (add-to-list 'custom-theme-load-path
               (file-name-as-directory (file-name-directory load-file-name))))

(provide 'stekene-theme-common)
;;; stekene-theme-common.el ends here
