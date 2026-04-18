import { escapeHtml } from "../../core/html-utils";

/**
 * Structured data used to render the shared base HTML template.
 */
export interface PageData {
  title: string;
  description: string;
  canonicalPath: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  themesGrid: string;
  fonts: string[];
  searchBar?: string;
  latestThemesHeadline?: string;
  mainCssPath: string;
  extraCssPaths?: string[];
  scripts?: string;
}

/**
 * Options that customize how the base template is rendered.
 */
export interface BaseTemplateOptions {
  baseUrl: string;
  githubUrl: string;
  titleBrandSuffix: string;
}

/**
 * Builds an absolute public URL for a generated page path.
 *
 * @param {string} baseUrl - Production site base URL.
 * @param {string} pagePath - Page path relative to site root (for example: "/about").
 * @returns {string} The absolute URL under the provided base domain.
 */
export function buildAbsolutePageUrl(baseUrl: string, pagePath: string): string {
  const trimmedPath = pagePath.trim();
  if (trimmedPath === "" || trimmedPath === "/") {
    return baseUrl;
  }

  // themes path is special
  if (trimmedPath === "/themes/") {
    return `${baseUrl}${trimmedPath}`;
  }

  const normalizedPath = `/${trimmedPath.replace(/^\/+|\/+$/g, "")}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Generates an HTML stylesheet link tag.
 *
 * @param {string} cssPath - The path to the CSS file.
 * @returns {string} The HTML string containing a stylesheet link.
 */
function getCssLinkTag(cssPath: string): string {
  return `<link rel="stylesheet" href="${cssPath}">`;
}

/**
 * Generates shared font preload tags injected into a rendered page.
 *
 * @param {string[]} fonts - Public font asset paths to preload.
 * @returns {string} HTML preload link tags for required font assets.
 */
function getFontPreloadTags(fonts: string[]): string {
  return fonts
    .map(
      (font) =>
        `<link rel="preload" href="${escapeHtml(font)}" as="font" type="font/woff2" crossorigin>`,
    )
    .join("\n");
}

/**
 * Injects page-specific data into the base HTML template (layout).
 *
 * @param {string} template - The base HTML template string.
 * @param {PageData} data - Content and configuration for the page.
 * @param {BaseTemplateOptions} options - Shared rendering options used across all pages.
 * @returns {string} The fully rendered HTML page.
 */
export function applyBaseTemplate(
  template: string,
  data: PageData,
  options: BaseTemplateOptions,
): string {
  const currentYear = new Date().getFullYear().toString();
  const brandedTitle = `${data.title}${options.titleBrandSuffix}`;
  const extraCssLinks = (data.extraCssPaths || []).map((path) => getCssLinkTag(path)).join("\n");
  const pageUrl = buildAbsolutePageUrl(options.baseUrl, data.canonicalPath);

  return template
    .replace("{{TITLE}}", escapeHtml(brandedTitle))
    .replace("{{DESCRIPTION}}", escapeHtml(data.description))
    .replace("{{CANONICAL_URL}}", escapeHtml(pageUrl))
    .replace("{{OG_URL}}", escapeHtml(pageUrl))
    .replace("{{TWITTER_URL}}", escapeHtml(pageUrl))
    .replace(/{{OG_TITLE}}/g, escapeHtml(data.ogTitle))
    .replace(/{{OG_DESCRIPTION}}/g, escapeHtml(data.ogDescription))
    .replace(/{{OG_IMAGE}}/g, escapeHtml(data.ogImage))
    .replace("{{FONTS}}", getFontPreloadTags(data.fonts))
    .replace("{{THEMES_GRID}}", data.themesGrid)
    .replace("{{SEARCH_BAR}}", data.searchBar || "")
    .replace("{{LATEST_THEMES_HEADLINE}}", data.latestThemesHeadline || "")
    .replace("{{MAIN_CSS_PRELOAD}}", getCssLinkTag(data.mainCssPath))
    .replace("{{EXTRA_CSS_PRELOAD}}", extraCssLinks)
    .replace("{{YEAR}}", currentYear)
    .replace("{{SCRIPTS}}", data.scripts || "")
    .replace(/{{GITHUB_URL}}/g, options.githubUrl);
}
