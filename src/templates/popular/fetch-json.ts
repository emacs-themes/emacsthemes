/**
 * Generic JSON fetch helper with timeout, bounded retries, and payload limits.
 */

const REQUEST_TIMEOUT_MS = 10000;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_RETRIES = 2; // Up to 3 total attempts per request.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRY_AFTER_MS = 5000;
const MAX_ERROR_BODY_SNIPPET_CHARS = 200;
const RETRY_BASE_DELAY_MS = 250;

/**
 * Normalizes unknown errors into readable messages for logging.
 *
 * @param {unknown} error - The error value to normalize.
 * @returns {string} The normalized error message.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Computes the delay before the next retry attempt.
 *
 * Honors the `Retry-After` header for rate-limit responses (capped at
 * {@link MAX_RETRY_AFTER_MS}); otherwise uses a fixed linear backoff.
 *
 * @param {number} attempt - The zero-based failed attempt index.
 * @param {Response} [response] - The failed response, when the failure was an HTTP status.
 * @returns {number} The delay in milliseconds.
 */
function retryDelayMs(attempt: number, response?: Response): number {
  if (response) {
    const retryAfter = Number(response.headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS);
    }
  }
  return RETRY_BASE_DELAY_MS * (attempt + 1);
}

/**
 * Reads a truncated body snippet for non-2xx error diagnostics.
 *
 * @param {Response} response - The non-2xx response.
 * @returns {Promise<string>} The snippet, or an empty string when unreadable.
 */
async function readErrorBodySnippet(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return body.length > MAX_ERROR_BODY_SNIPPET_CHARS
      ? `${body.slice(0, MAX_ERROR_BODY_SNIPPET_CHARS)}...`
      : body;
  } catch {
    return "";
  }
}

/**
 * Fetches and parses JSON from a URL with timeout, bounded retries, and a size cap.
 *
 * - Aborts each attempt after {@link REQUEST_TIMEOUT_MS} via `AbortSignal.timeout`.
 * - Retries transient network failures and retryable statuses (429, 5xx) with
 *   a short backoff, at most {@link MAX_RETRIES} extra attempts.
 * - Rejects responses whose body exceeds {@link MAX_PAYLOAD_BYTES}.
 * - Surfaces a truncated body snippet for non-2xx responses to aid diagnostics.
 *
 * @param {string} url - The URL to request.
 * @param {Record<string, string>} [headers] - Optional request headers.
 * @param {RequestInit} [init] - Additional fetch options (for example `redirect: "error"`).
 * @returns {Promise<T>} A promise that resolves to the parsed JSON payload.
 * @throws {Error} On non-2xx responses, timeouts, oversized bodies, or invalid JSON.
 */
export async function fetchJson<T>(
  url: string,
  headers?: Record<string, string>,
  init?: RequestInit,
): Promise<T> {
  let attempt = 0;

  while (true) {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms for ${url}`, {
          cause: error,
        });
      }
      if (attempt < MAX_RETRIES) {
        attempt++;
        await Bun.sleep(retryDelayMs(attempt));
        continue;
      }
      throw new Error(`Request to ${url} failed: ${getErrorMessage(error)}`, { cause: error });
    }

    if (!response.ok) {
      if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
        attempt++;
        await Bun.sleep(retryDelayMs(attempt, response));
        continue;
      }
      const snippet = await readErrorBodySnippet(response);
      const detail = snippet ? `; body: ${snippet}` : "";
      throw new Error(`Request failed with status ${response.status} for ${url}${detail}`);
    }

    const body = await response.text();
    if (body.length > MAX_PAYLOAD_BYTES) {
      throw new Error(
        `Response from ${url} exceeds the ${MAX_PAYLOAD_BYTES} byte limit; refusing to buffer it`,
      );
    }
    try {
      return JSON.parse(body) as T;
    } catch (error) {
      throw new Error(`Invalid JSON response from ${url}: ${getErrorMessage(error)}`, {
        cause: error,
      });
    }
  }
}
