import { escapeHtml } from "../../core/html-utils";

/**
 * Theme properties required for generating theme cards.
 */
export interface ThemeCardTheme {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
}

/**
 * Generates the HTML for a single theme card.
 *
 * @param {ThemeCardTheme} theme - Theme details used to populate the card template.
 * @param {string} template - The HTML template string for the card.
 * @param {string} [relativeRoot=""] - Relative path prefix from the current page to site root.
 * @param {string} [staticDir="static"] - Static assets directory name used in generated image URLs.
 * @returns {string} The populated HTML string for the theme card.
 */
export function generateThemeCard(
  theme: ThemeCardTheme,
  template: string,
  relativeRoot: string = "",
  staticDir: string = "static",
): string {
  const imagePath = `${relativeRoot}${staticDir}/imgs/${theme.id}/preview.png`;

  return template
    .replace(/{{THEME_NAME}}/g, escapeHtml(theme.name))
    .replace(/{{THEME_ID}}/g, theme.id)
    .replace(/{{THEME_DESCRIPTION}}/g, escapeHtml(theme.description))
    .replace(/{{THEME_REPO_URL}}/g, theme.repoUrl)
    .replace(/{{THEME_LOCAL_URL}}/g, theme.id)
    .replace(/{{THEME_IMAGE_PATH}}/g, imagePath);
}

/**
 * Builds a full themes grid from a list of themes and a card template.
 *
 * @param {ThemeCardTheme[]} themes - Ordered themes to render.
 * @param {string} cardTemplate - Card HTML template used for each item.
 * @param {string} [relativeRoot=""] - Relative path prefix from the current page to site root.
 * @param {string} [staticDir="static"] - Static assets directory name used in generated image URLs.
 * @returns {string} A complete `<div class="grid">` block with all rendered cards.
 */
export function buildThemeCardsGrid(
  themes: ThemeCardTheme[],
  cardTemplate: string,
  relativeRoot: string = "",
  staticDir: string = "static",
): string {
  const cards = themes.map((theme) =>
    generateThemeCard(theme, cardTemplate, relativeRoot, staticDir),
  );
  return `<div class="grid">${cards.join("\n")}</div>`;
}
