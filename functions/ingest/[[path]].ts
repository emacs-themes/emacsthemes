/**
 * Proxies same-origin SDK requests to PostHog EU without forwarding site credentials.
 * @param context - The Pages request context under /ingest.
 * @returns The upstream response, or 405 for unsupported methods.
 */
export const onRequest: PagesFunction = async ({ request }) => {
  if (!["GET", "HEAD", "POST", "OPTIONS"].includes(request.method)) {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD, POST, OPTIONS" },
    });
  }

  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/ingest(?=\/|$)/, "") || "/";
  url.hostname =
    url.pathname.startsWith("/static/") || url.pathname.startsWith("/array/")
      ? "eu-assets.i.posthog.com"
      : "eu.i.posthog.com";
  url.protocol = "https:";
  url.port = "";

  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("authorization");
  headers.delete("host");
  headers.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") || "");

  return fetch(url, {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });
};
