import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  collectPngFiles,
  convertPngToWebp,
  parseCliArgs,
  toWebpPath,
} from "../src/scripts/convert-theme-imgs-to-webp";

describe("convert-theme-imgs-to-webp", () => {
  test("maps png paths to webp paths", () => {
    expect(toWebpPath("static/imgs/theme-a/preview.png")).toBe("static/imgs/theme-a/preview.webp");
  });

  test("parses conversion flags", () => {
    const options = parseCliArgs([
      "--replace",
      "--overwrite",
      "--dry-run",
      "--source-dir=static/imgs",
      "--quality=90",
    ]);

    expect(options).toEqual({
      sourceDir: "static/imgs",
      replace: true,
      overwrite: true,
      dryRun: true,
      quality: 90,
    });
  });

  test("collects png files recursively", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "emacsthemes-webp-"));
    try {
      await mkdir(join(tempDir, "nested"), { recursive: true });
      await writeFile(join(tempDir, "root.png"), new Uint8Array([1, 2, 3]));
      await writeFile(join(tempDir, "ignore.txt"), "ignore");
      await writeFile(join(tempDir, "nested", "one.png"), new Uint8Array([4, 5, 6]));
      await writeFile(join(tempDir, "nested", "two.webp"), new Uint8Array([7, 8, 9]));

      const files = await collectPngFiles(tempDir);

      expect(files).toEqual([join(tempDir, "nested", "one.png"), join(tempDir, "root.png")]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("converts png files to webp and removes the source when requested", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "emacsthemes-webp-convert-"));
    try {
      const sourcePath = join(tempDir, "theme", "preview.png");
      const destPath = join(tempDir, "theme", "preview.webp");

      await mkdir(join(tempDir, "theme"), { recursive: true });
      await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 },
        },
      })
        .png()
        .toFile(sourcePath);

      await convertPngToWebp(sourcePath, destPath, 82, true);

      expect(await Bun.file(sourcePath).exists()).toBe(false);
      expect(await Bun.file(destPath).exists()).toBe(true);

      const bytes = new Uint8Array(await Bun.file(destPath).arrayBuffer());
      expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
      expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WEBP");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
