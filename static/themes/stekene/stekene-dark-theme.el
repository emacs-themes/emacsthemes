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

(require 'stekene-theme-common)

(deftheme stekene-dark "The dark version of the stekene theme.")

(stekene-theme--set-faces
 stekene-dark
 ((foreground "#e0e0e0")
  (background "#242424")
  (region "#4f4f4f")
  (hlline "#333333")
  (highlight "#224422")
  (modelinebg "#3f3f3f")
  (gray1 "#777777")
  (gray2 "#a0a0a0")
  (dullgreen "#99b099")
  (dullred "#b79999")
  (dullyellow "#b4b499")
  (red "#ff9090")
  (orange1 "#ffa090")
  (orange2 "#ffbb90")
  (yellow1 "#eed599")
  (yellow2 "#ffee90")
  (blue1 "#99b4c4")
  (blue2 "#8894a4")
  (blue3 "#9999c8")
  (fringebg "#1a1a1a")
  (whitespaceline "#64231f")
  (whitespacetrailing "#94332f")
  (symbol1 "#edb9b8")
  (symbol2 "#e9bcab")
  (symbol3 "#dfc1a3")
  (symbol4 "#d1c6a1")
  (symbol5 "#c0caa5")
  (symbol6 "#afceaf")
  (symbol7 "#a0d0bd")
  (symbol8 "#96d1cd")
  (symbol9 "#94d0db")
  (symbol10 "#9ccde6")
  (symbol11 "#acc9eb")
  (symbol12 "#c0c4e9")
  (symbol13 "#d2bfe2")
  (symbol14 "#e2bbd5")
  (symbol15 "#ebb9c7")
  (delim1 "#b8968d")
  (delim2 "#ac9b83")
  (delim3 "#99a086")
  (delim4 "#85a494")
  (delim5 "#7aa5a6")
  (delim6 "#80a2b4")
  (delim7 "#949db7")
  (delim8 "#aa97af")
  (delim9 "#b8949e")
  (delimlightness 80)
  (delimsaturation 18)
  (block1 "#242a24")
  (block2 "#27272d")
  (block3 "#302a2a")
  (block4 "#2d332d")
  (block5 "#303036")
  (block6 "#393333")
  (block7 "#363c36")
  (block8 "#39393f")
  (block9 "#423c3c")))

(provide-theme 'stekene-dark)
;;; stekene-dark-theme.el ends here
