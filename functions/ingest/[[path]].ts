/**
 * Endpoints the PostHog browser SDK calls. Everything else is refused so /ingest
 * cannot be used as an open proxy to the rest of the PostHog API.
 */
const PROXYABLE_PATH = /^\/(?:static|array|decide|flags|e|i|s|batch|surveys|capture)(?:\/|$)/;

/**
 * Proxies same-origin SDK requests to PostHog EU without forwarding site credentials.
 * @param context - The Pages request context under /ingest.
 * @returns The upstream response, 404 for paths outside the SDK surface, or 405 for unsupported methods.
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

  if (!PROXYABLE_PATH.test(url.pathname)) return new Response("Not found", { status: 404 });

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
