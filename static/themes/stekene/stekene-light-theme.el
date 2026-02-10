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

(deftheme stekene-light "The light version of the stekene theme.")

(stekene-theme--set-faces
 stekene-light
 ((foreground "#242424")
  (background "#f8f8f8")
  (region "#bbbbbb")
  (hlline "#dddddd")
  (highlight "#aaccaa")
  (modelinebg "#dddddd")
  (gray1 "#919191")
  (gray2 "#666666")
  (dullgreen "#557755")
  (dullred "#775555")
  (dullyellow "#777755")
  (red "#e83333")
  (orange1 "#e85533")
  (orange2 "#b86833")
  (yellow1 "#777722")
  (yellow2 "#777722")
  (blue1 "#336688")
  (blue2 "#666699")
  (blue3 "#555588")
  (fringebg "#dddddd")
  (whitespaceline "#fac9c0")
  (whitespacetrailing "#fa8980")
  (symbol1 "#934748")
  (symbol2 "#8b4e34")
  (symbol3 "#7d5626")
  (symbol4 "#695e22")
  (symbol5 "#51642a")
  (symbol6 "#35693b")
  (symbol7 "#006b51")
  (symbol8 "#006c69")
  (symbol9 "#006b7f")
  (symbol10 "#00688f")
  (symbol11 "#0d6396")
  (symbol12 "#4c5b94")
  (symbol13 "#6f5288")
  (symbol14 "#854976")
  (symbol15 "#91455f")
  (delim1 "#7c544a")
  (delim2 "#6e5b3e")
  (delim3 "#586241")
  (delim4 "#3f6652")
  (delim5 "#2a6768")
  (delim6 "#32647a")
  (delim7 "#505d7e")
  (delim8 "#6d5673")
  (delim9 "#7d525e")
  (delimlightness 35)
  (delimsaturation 40)
  (block1 "#f8ebeb")
  (block2 "#ebf8eb")
  (block3 "#ebebf8")
  (block4 "#f8f8eb")
  (block5 "#ebf8f8")
  (block6 "#f8ebf8")
  (block7 "#e8dada")
  (block8 "#dae8da")
  (block9 "#dadae8")))

(provide-theme 'stekene-light)
;;; stekene-light-theme.el ends here
