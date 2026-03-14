import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { SCREENSHOT_DATES_PATH } from "../src/core/constants";

describe("Screenshot date metadata", () => {
  test("stays serialized in canonical key order", async () => {
    const raw = await readFile(SCREENSHOT_DATES_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    const canonical = `${JSON.stringify(Object.fromEntries(Object.entries(parsed).toSorted()), null, 2)}\n`;

    expect(raw).toBe(canonical);
  });
});
