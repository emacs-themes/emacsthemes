;;; colorsarenice-light-theme.el --- The light colorsarenice theme. -*- lexical-binding: t -*-

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

(require 'colorsarenice-common)

(deftheme colorsarenice-light "The light colorsarenice theme.")

(colorsarenice--set-faces
 colorsarenice-light
 ((foreground "#161616")
  (background "#faf9f0")
  (region "#aaaaaa")
  (hlline "#dddddd")
  (highlight "#aaccaa")
  (orange "#a96c2f")
  (gray "#888888")
  (yellow "#70702c")
  (blue1 "#28286a")
  (blue2 "#1d6a6a")
  (red1 "#b4212c")
  (red2 "#802320")
  (green "#2c722c")
  (purple "#751472")
  (modelinefg "#500040")
  (modelinebg "#dfddd8")
  (fringebg "#dfddd8")
  (whitespaceline "#fac9c0")
  (whitespacetrailing "#fa8980")))

(provide-theme 'colorsarenice-light)
;;; colorsarenice-light-theme.el ends here
