(defun log-debug (fmt &rest args)
  (let ((msg (apply #'format fmt args)))
    (message "%s" msg)
    (princ (concat msg "\n") #'external-debugging-output)))

(log-debug "DEBUG EMACS: Starting Emacs init...")
(add-to-list 'load-path "{{THEME_DIR}}")
(log-debug "DEBUG EMACS: Added {{THEME_DIR}} to load-path")

;; Make emacs full window
(set-frame-parameter nil 'fullscreen 'fullboth)

(setq inhibit-splash-screen t)
(setq initial-scratch-message nil)
(menu-bar-mode -1)
(tool-bar-mode -1)
(scroll-bar-mode -1)
(set-face-attribute 'default nil :height 140)

(log-debug "DEBUG EMACS: Attempting to load theme...")

;; Add current dir to theme load path
(add-to-list 'custom-theme-load-path "{{THEME_DIR}}")

;; Try to load and enable theme based on name
(let ((name-symbol (intern "{{THEME_NAME}}")))
   (condition-case err
       (load-theme name-symbol t)
     (error (log-debug "Auto-loading theme %s failed: %s" name-symbol err))))

{{EXTRA_ELISP}}

(if custom-enabled-themes
  (log-debug "DEBUG EMACS: Theme loaded successfully")
  (log-debug "DEBUG EMACS: Error: No theme loaded"))

{{MODE_SPECIFIC_LOGIC}}

(redisplay t)
(log-debug "DEBUG EMACS: Emacs init completed.")
