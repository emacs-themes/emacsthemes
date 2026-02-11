(defun log-debug (fmt &rest args)
  (let ((msg (apply #'format fmt args)))
    (message "DEBUG EMACS: %s" msg)
    (princ (concat "DEBUG EMACS:" msg "\n") #'external-debugging-output)))

(log-debug "Starting Emacs init...")

;; Initialize package.el for themes that have dependencies
(require 'package)
(add-to-list 'package-archives '("melpa" . "https://melpa.org/packages/") t)
(setq package-check-signature nil)
(package-initialize)

(add-to-list 'load-path "{{THEME_DIR}}")
(log-debug "Added {{THEME_DIR}} to load-path")

(log-debug "Running extra elisp...")
(condition-case err
    (progn
      {{EXTRA_ELISP}})
  (error (log-debug "Extra elisp execution failed: %s" err)))

(log-debug "Loading theme files: {{THEME_FILES}}")
(condition-case err
    (progn
      {{LOAD_THEME_FILES}})
  (error (log-debug "Error loading theme files: %s" err)))

;; Make emacs full window
(set-frame-parameter nil 'fullscreen 'fullboth)

(setq inhibit-splash-screen t)
(setq initial-scratch-message nil)
(menu-bar-mode -1)
(tool-bar-mode -1)
(scroll-bar-mode -1)
(set-face-attribute 'default nil :height 140)

(log-debug "Attempting to load theme...")

;; Add current dir to theme load path
(log-debug "Adding theme dir '{{THEME_DIR}}' to custom-theme-load-path")
(add-to-list 'custom-theme-load-path "{{THEME_DIR}}")

;; Try to load and enable theme based on name
(log-debug "Enabling theme. Theme name: '{{THEME_NAME}}'" )
(unless custom-enabled-themes
  (let ((name-symbol (intern "{{THEME_NAME}}")))
     (condition-case err
         (load-theme name-symbol t)
       (error (log-debug "Auto-loading theme %s failed: %s" name-symbol err)))))

(if custom-enabled-themes
    (log-debug "Theme loaded successfully: %s" custom-enabled-themes)
  (log-debug "Error: No theme loaded. Aborting screenshot.")
  (kill-emacs 1))

{{MODE_SPECIFIC_LOGIC}}

(redisplay t)
(log-debug "Emacs init completed.")

(with-temp-file "{{READY_FILE}}"
  (insert "ready"))
