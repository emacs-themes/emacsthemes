import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { onRequest } from "../functions/ingest/[[path]]";

let upstream: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
beforeEach(() => {
  upstream = spyOn(globalThis, "fetch");
});
afterEach(() => upstream.mockRestore());

/** Calls the Pages handler with a request and no unused context fields. */
function proxy(request: Request) {
  return onRequest({ request } as Parameters<typeof onRequest>[0]);
}

test("routes SDK assets and API paths to fixed EU hosts, preserving queries", async () => {
  upstream.mockResolvedValue(new Response("upstream"));
  for (const [path, host] of [
    ["static/array.js?v=1", "eu-assets.i.posthog.com"],
    ["array/project/config?v=2", "eu-assets.i.posthog.com"],
    ["flags/?v=2", "eu.i.posthog.com"],
    ["e/?compression=gzip-js", "eu.i.posthog.com"],
    ["/attacker.example/static/array.js", "eu.i.posthog.com"],
  ]) {
    await proxy(new Request(`http://localhost:8788/ingest/${path}`));
    expect(upstream.mock.lastCall?.[0].toString()).toBe(`https://${host}/${path}`);
  }
});

test("preserves POST bytes and upstream failures while stripping site credentials", async () => {
  const response = new Response("retry", { status: 429, headers: { "Retry-After": "10" } });
  upstream.mockResolvedValue(response);
  const body = new Uint8Array([0, 255, 42]);
  const result = await proxy(
    new Request("https://emacsthemes.com/ingest/e/?v=1", {
      method: "POST",
      body,
      headers: {
        Cookie: "session=private",
        Authorization: "Bearer private",
        Host: "emacsthemes.com",
        "Content-Type": "application/octet-stream",
        "CF-Connecting-IP": "192.0.2.1",
        "X-Forwarded-For": "spoofed",
      },
    }),
  );
  const options = upstream.mock.lastCall?.[1];
  const headers = new Headers(options?.headers);
  expect(options?.method).toBe("POST");
  expect(options?.redirect).toBe("manual");
  expect(new Uint8Array(await new Response(options?.body).arrayBuffer())).toEqual(body);
  expect(headers.has("cookie")).toBe(false);
  expect(headers.has("authorization")).toBe(false);
  expect(headers.has("host")).toBe(false);
  expect(headers.get("x-forwarded-for")).toBe("192.0.2.1");
  expect(headers.get("content-type")).toBe("application/octet-stream");
  expect(result).toBe(response);
});

test("rejects unsupported methods without contacting PostHog", async () => {
  const response = await proxy(
    new Request("https://emacsthemes.com/ingest/e/", { method: "DELETE" }),
  );
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toBe("GET, HEAD, POST, OPTIONS");
  expect(upstream).not.toHaveBeenCalled();
});
