import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import sharp from "sharp";

export const DEFAULT_QUALITY = 82;
const DEFAULT_SOURCE_DIR = "static/imgs";
const LOG_PREFIX = "[webp-convert]";

interface CliOptions {
  sourceDir: string;
  replace: boolean;
  overwrite: boolean;
  dryRun: boolean;
  quality: number;
}

/**
 * Parses CLI arguments for the PNG-to-WebP conversion workflow.
 *
 * @param {string[]} argv - CLI arguments after the executable name.
 * @returns {CliOptions} Normalized conversion options.
 */
export function parseCliArgs(argv: string[]): CliOptions {
  let sourceDir = DEFAULT_SOURCE_DIR;
  let replace = false;
  let overwrite = false;
  let dryRun = false;
  let quality = DEFAULT_QUALITY;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--replace") {
      replace = true;
      continue;
    }

    if (arg === "--overwrite") {
      overwrite = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--source-dir") {
      sourceDir = argv[i + 1] || sourceDir;
      i += 1;
      continue;
    }

    if (arg.startsWith("--source-dir=")) {
      sourceDir = arg.split("=", 2)[1] || sourceDir;
      continue;
    }

    if (arg === "--quality") {
      quality = parseQuality(argv[i + 1], quality);
      i += 1;
      continue;
    }

    if (arg.startsWith("--quality=")) {
      quality = parseQuality(arg.split("=", 2)[1], quality);
      continue;
    }
  }

  return { sourceDir, replace, overwrite, dryRun, quality };
}

/**
 * Parses and bounds the WebP quality value.
 *
 * @param {string | undefined} value - Raw CLI value.
 * @param {number} fallback - Value used when parsing fails.
 * @returns {number} A WebP quality value between 1 and 100.
 */
function parseQuality(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

/**
 * Converts a PNG path to its WebP sibling path.
 *
 * @param {string} pngPath - The original PNG file path.
 * @returns {string} The corresponding WebP file path.
 */
export function toWebpPath(pngPath: string): string {
  if (!pngPath.toLowerCase().endsWith(".png")) {
    throw new Error(`Expected a PNG file path, got: ${pngPath}`);
  }

  return pngPath.slice(0, -4) + ".webp";
}

/**
 * Recursively collects PNG files from a directory tree.
 *
 * @param {string} sourceDir - Root directory to scan.
 * @returns {Promise<string[]>} A sorted list of absolute PNG file paths.
 */
export async function collectPngFiles(sourceDir: string): Promise<string[]> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectPngFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      files.push(entryPath);
    }
  }

  return files.toSorted((left, right) => left.localeCompare(right));
}

/**
 * Converts a PNG file to a WebP file.
 *
 * @param {string} sourcePath - Absolute or relative path to the PNG file.
 * @param {string} destPath - Absolute or relative path to the WebP file.
 * @param {number} quality - WebP quality, from 1 to 100.
 * @returns {Promise<void>} A promise that resolves when the file has been written.
 */
export async function convertPngToWebp(
  sourcePath: string,
  destPath: string,
  quality: number,
  removeSource = false,
) {
  const input = await readFile(sourcePath);
  await mkdir(dirname(destPath), { recursive: true });
  await sharp(input).webp({ quality }).toFile(destPath);

  if (removeSource) {
    await rm(sourcePath);
  }
}

/**
 * Runs the PNG-to-WebP conversion against the configured source directory.
 *
 * @param {CliOptions} options - Conversion options derived from the CLI.
 * @returns {Promise<void>} A promise that resolves when conversion completes.
 */
export async function runConversion(options: CliOptions): Promise<void> {
  const absoluteSourceDir = resolve(options.sourceDir);
  const sourceStat = await stat(absoluteSourceDir);

  if (!sourceStat.isDirectory()) {
    throw new Error(`Source directory is not a directory: ${options.sourceDir}`);
  }

  const pngFiles = await collectPngFiles(absoluteSourceDir);

  if (pngFiles.length === 0) {
    console.log(`${LOG_PREFIX} No PNG files found in ${options.sourceDir}`);
    return;
  }

  let convertedCount = 0;
  let skippedCount = 0;

  for (const sourcePath of pngFiles) {
    const destPath = toWebpPath(sourcePath);
    const relativeSource = relative(absoluteSourceDir, sourcePath);
    const relativeDest = relative(absoluteSourceDir, destPath);

    if (!options.overwrite) {
      try {
        const destStat = await stat(destPath);
        if (destStat.isFile()) {
          console.log(`${LOG_PREFIX} Skipping existing ${relativeDest}`);
          skippedCount += 1;
          continue;
        }
      } catch {
        // The WebP file does not exist yet.
      }
    }

    if (options.dryRun) {
      console.log(`${LOG_PREFIX} Would convert ${relativeSource} -> ${relativeDest}`);
      convertedCount += 1;
      continue;
    }

    await convertPngToWebp(sourcePath, destPath, options.quality, options.replace);
    console.log(`${LOG_PREFIX} Converted ${relativeSource} -> ${relativeDest}`);

    if (options.replace) {
      console.log(`${LOG_PREFIX} Removed source ${relativeSource}`);
    }

    convertedCount += 1;
  }

  console.log(
    `${LOG_PREFIX} Done. Converted ${convertedCount} file(s), skipped ${skippedCount} file(s).`,
  );
}

if (import.meta.main) {
  runConversion(parseCliArgs(Bun.argv.slice(2))).catch((error) => {
    console.error(`${LOG_PREFIX} Failed:`, error);
    process.exitCode = 1;
  });
}
