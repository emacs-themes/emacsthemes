import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { spawn } from "node:child_process";

const BUCKET_NAME = "emacsthemes";
const IMGS_DIR = "static/imgs";

async function getFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const res = join(dir, entry.name);
      return entry.isDirectory() ? getFiles(res) : res;
    })
  );
  return files.flat();
}

async function uploadFile(filePath: string) {
  const key = relative(IMGS_DIR, filePath);
  console.log(`Uploading ${key}...`);

  return new Promise((resolve, reject) => {
    const child = spawn("wrangler", [
      "r2",
      "object",
      "put",
      `${BUCKET_NAME}/${key}`,
      "--file",
      filePath,
    ]);

    child.on("close", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`Wrangler exited with code ${code} for ${key}`));
    });
  });
}

async function run() {
  try {
    const files = await getFiles(IMGS_DIR);
    console.log(`Found ${files.length} images to upload.`);

    // Upload in batches to avoid overwhelming the system/network
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map((f) => uploadFile(f)));
      console.log(`Progress: ${Math.min(i + batchSize, files.length)}/${files.length}`);
    }

    console.log("All images uploaded successfully!");
  } catch (err) {
    console.error("Upload failed:", err);
    process.exit(1);
  }
}

run();
