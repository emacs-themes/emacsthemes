;;; sample.el --- A complex Emacs Lisp sample for syntax highlighting -*- lexical-binding: t; -*-

(require 'cl-lib)

(defgroup sample-theme nil
  "Customization group for the sample theme."
  :group 'faces)

(defcustom sample-theme-enable-italic t
  "Whether to enable italics in the theme."
  :type 'boolean
  :group 'sample-theme)

(defvar sample-theme-colors
  '((bg      . "#282c34")
    (fg      . "#abb2bf")
    (red     . "#e06c75")
    (green   . "#98c379")
    (yellow  . "#d19a66")
    (blue    . "#61afef")
    (magenta . "#c678dd")
    (cyan    . "#56b6c2"))
  "Color palette for the sample theme.")

(defun sample-theme-get-color (name)
  "Retrieve a color from `sample-theme-colors` by NAME."
  (cdr (assoc name sample-theme-colors)))

(defmacro with-sample-palette (&rest body)
  "Execute BODY with colors bound to local variables."
  `(let ((bg (sample-theme-get-color 'bg))
         (fg (sample-theme-get-color 'fg))
         (blue (sample-theme-get-color 'blue)))
     ,@body))

(cl-defun sample-theme-setup (&key (mode 'dark) (padding 10))
  "Initialize the theme with specific options."
  (message "Setting up %s theme with padding %d" mode padding)
  (with-sample-palette
   (set-face-attribute 'default nil :background bg :foreground fg)
   (set-face-attribute 'font-lock-function-name-face nil :foreground blue :weight 'bold)))

(definterface sample-protocol ()
  (print-name (self) "Return the name."))

(provide 'sample-theme)
;;; sample.el ends here
