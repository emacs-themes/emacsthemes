/**
 * Escapes special characters in a string for use in HTML, preventing XSS.
 *
 * @param str - The string to escape.
 * @returns The escaped string.
 */
export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Returns a normalized `http:`/`https:` URL string, or undefined for unsafe values.
 *
 * Unparseable URLs (for example relative paths) and non-http(s) schemes
 * (`javascript:`, `data:`, ...) are never linked. The returned value is the
 * normalized URL (`new URL(url).toString()`), so escaping/encoding is applied
 * consistently before the value reaches an `href` attribute.
 *
 * @param {string} url - The candidate link URL.
 * @returns {string | undefined} The normalized URL when safe, or undefined.
 */
export function toSafeUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // Unparseable URLs (for example relative paths) are never linked.
  }
  return undefined;
}
