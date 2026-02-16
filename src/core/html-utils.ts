/**
 * Escapes special characters in a string for use in HTML, preventing XSS.
 *
 * @param str - The string to escape.
 * @returns The escaped string.
 */
export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}
