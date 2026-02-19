;;; lenlen-solarized-compat.el --- Compatibility shims for lenlen theme

;;; Code:

(defvar lenlen--solarized-color-definitions-orig nil)

(when (fboundp 'solarized-color-definitions)
  (setq lenlen--solarized-color-definitions-orig (symbol-function 'solarized-color-definitions))
  (defun solarized-color-definitions (&optional mode)
    (funcall lenlen--solarized-color-definitions-orig (or mode 'light))))

(defmacro create-solarized-theme (name description body)
  `(progn
     (deftheme ,name ,description)
     (let* ((definitions ,body)
            (faces (car definitions)))
       (when faces
         (apply #'custom-theme-set-faces ',name faces)))))

;;; lenlen-solarized-compat.el ends here
