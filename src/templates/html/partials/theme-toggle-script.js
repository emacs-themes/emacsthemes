/**
 * Bootstraps the site-wide theme toggle with localStorage persistence.
 *
 * Behavior:
 * - Uses light mode as the first-visit default.
 * - Persists explicit user choice to localStorage.
 * - Updates toggle button ARIA and icon state.
 */
(function () {
  const THEME_STORAGE_KEY = "emacsthemes:theme";
  const LIGHT_THEME = "light";
  const DARK_THEME = "dark";

  /**
   * Returns a normalized theme value from storage.
   *
   * @returns {"light" | "dark"} Stored theme when valid; otherwise light.
   */
  function getStoredTheme() {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (value === DARK_THEME || value === LIGHT_THEME) {
      return value;
    }

    return LIGHT_THEME;
  }

  /**
   * Applies the current theme to the root HTML element.
   *
   * @param {"light" | "dark"} theme - Theme mode to apply.
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  /**
   * Updates toggle button UI labels for the active theme.
   *
   * @param {HTMLButtonElement} button - Toggle button element.
   * @param {"light" | "dark"} activeTheme - Currently active theme.
   */
  function syncToggleButton(button, activeTheme) {
    const isDark = activeTheme === DARK_THEME;
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("data-next-theme", isDark ? LIGHT_THEME : DARK_THEME);
  }

  /**
   * Computes the next theme from the active one.
   *
   * @param {"light" | "dark"} currentTheme - Current theme.
   * @returns {"light" | "dark"} Opposite theme value.
   */
  function toggleTheme(currentTheme) {
    return currentTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
  }

  const toggleButton = document.getElementById("theme-toggle");
  if (!(toggleButton instanceof HTMLButtonElement)) {
    return;
  }

  let activeTheme = getStoredTheme();
  applyTheme(activeTheme);
  syncToggleButton(toggleButton, activeTheme);

  toggleButton.addEventListener("click", () => {
    activeTheme = toggleTheme(activeTheme);
    applyTheme(activeTheme);
    syncToggleButton(toggleButton, activeTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
  });
})();
