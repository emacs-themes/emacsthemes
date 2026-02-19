;;; colorsarenice-dark-theme.el --- The dark colorsarenice theme. -*- lexical-binding: t -*-

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

(deftheme colorsarenice-dark "The dark colorsarenice theme.")

(colorsarenice--set-faces
 colorsarenice-dark
 ((foreground "#dadada")
  (background "#24231f")
  (region "#4f4f4f")
  (hlline "#333333")
  (highlight "#224422")
  (orange "#edb082")
  (gray "#888888")
  (yellow "#d4d484")
  (blue1 "#9f9fdf")
  (blue2 "#88aabb")
  (red1 "#e67c7c")
  (red2 "#cf9d9d")
  (green "#a3d48b")
  (purple "#c08ad6")
  (modelinefg "#da9fbf")
  (modelinebg "#3f3d38")
  (fringebg "#181818")
  (whitespaceline "#64231f")
  (whitespacetrailing "#94332f")))

(provide-theme 'colorsarenice-dark)
;;; colorsarenice-dark-theme.el ends here
