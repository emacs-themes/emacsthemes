;;; colorsarenice-common.el --- Common stuff for the colorsarenice themes. -*- lexical-binding: t -*-

;; Author: Fanael Linithien <fanael4@gmail.com>
;; URL: https://github.com/Fanael/colorsarenice-theme

;; This file is NOT part of GNU Emacs.

;; Copyright (c) 2013-2014, Fanael Linithien
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

(defmacro colorsarenice--set-faces (name palette)
  `(let ,(cons '(class '((class color) (min-colors 89))) palette)
     (custom-theme-set-faces
      ',name
      `(default ((,class (:background ,background :foreground ,foreground))))
      `(cursor ((,class (:background ,foreground))))
      `(region ((,class (:background ,region))))
      `(highlight ((,class (:background ,highlight))))
      `(font-lock-builtin-face ((,class (:foreground ,orange))))
      `(font-lock-preprocessor-face ((,class (:foreground ,red2))))
      `(font-lock-comment-face ((,class (:foreground ,gray))))
      `(font-lock-constant-face ((,class (:foreground ,yellow))))
      `(font-lock-function-name-face ((,class (:foreground ,blue1))))
      `(font-lock-keyword-face ((,class (:foreground ,red1))))
      `(font-lock-string-face ((,class (:foreground ,green))))
      `(font-lock-type-face ((,class (:foreground ,purple))))
      `(font-lock-variable-name-face ((,class (:foreground ,blue2))))

      `(hl-line ((,class (:background ,hlline))))
      `(show-paren-match-face ((,class (:background ,region))))

      `(whitespace-line ((,class (:background ,whitespaceline :foreground nil))))
      `(whitespace-trailing ((,class (:background ,whitespacetrailing :foreground nil))))

      `(fringe ((,class (:background ,fringebg))))
      `(linum ((,class (:background ,background :foreground ,gray))))

      `(mode-line ((,class
                    (:background ,modelinebg :foreground ,modelinefg :box nil))))

      `(minibuffer-prompt ((,class (:foreground ,orange))))

      `(ido-subdir ((,class (:foreground ,red2))))
      `(ido-only-match ((,class (:foreground ,green))))

      `(evil-ex-info ((,class (:foreground ,red1 :weight bold))))
      `(evil-ex-substitute-replacement ((,class
                                         (:foreground ,red1 :weight bold :underline t))))

      `(rainbow-delimiters-depth-1-face ((,class (:foreground ,red1))))
      `(rainbow-delimiters-depth-2-face ((,class (:foreground ,red2))))
      `(rainbow-delimiters-depth-3-face ((,class (:foreground ,orange))))
      `(rainbow-delimiters-depth-4-face ((,class (:foreground ,yellow))))
      `(rainbow-delimiters-depth-5-face ((,class (:foreground ,green))))
      `(rainbow-delimiters-depth-6-face ((,class (:foreground ,blue1))))
      `(rainbow-delimiters-depth-7-face ((,class (:foreground ,blue2))))
      `(rainbow-delimiters-depth-8-face ((,class (:foreground ,purple))))
      `(rainbow-delimiters-depth-9-face ((,class (:foreground ,modelinefg)))))))

;;;###autoload
(when load-file-name
  (add-to-list 'custom-theme-load-path
               (file-name-as-directory (file-name-directory load-file-name))))

(provide 'colorsarenice-common)
;;; colorsarenice-common.el ends here
