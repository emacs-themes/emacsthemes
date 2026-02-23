import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const BUCKET_NAME = "emacsthemes";
const IMGS_DIR = "static/imgs";
const TEMPLATE_PATH = "src/cloudflare/rclone.conf.template";
const CONFIG_PATH = ".tmp/rclone.conf";
const CUSTOM_CA_CERT_PATH = process.env.CLOUDFLARE_R2_CA_CERT_PATH;

async function generateConfig() {
  console.log("Generating rclone config...");
  let template = await readFile(TEMPLATE_PATH, "utf-8");

  const vars = {
    CLOUDFLARE_R2_ACCESS_KEY: process.env.CLOUDFLARE_R2_ACCESS_KEY,
    CLOUDFLARE_R2_SECRET_KEY: process.env.CLOUDFLARE_R2_SECRET_KEY,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  };

  // Basic interpolation
  for (const [key, value] of Object.entries(vars)) {
    if (!value) {
      throw new Error(
        `Missing environment variable: ${key}. Make sure it's defined in your .env file or environment.`,
      );
    }
    template = template.replace(new RegExp(`\\\${${key}}`, "g"), value);
  }

  await mkdir(".tmp", { recursive: true });
  await writeFile(CONFIG_PATH, template);
}

async function runRclone() {
  console.log(`Syncing ${IMGS_DIR} to R2 bucket ${BUCKET_NAME} using rclone...`);

  const args = [
    "sync",
    IMGS_DIR,
    `emacsthemes:${BUCKET_NAME}`,
    "--config",
    CONFIG_PATH,
    "--fast-list", // Drastically reduces LIST calls
    "--size-only", // Skips extra metadata/hash checks
    "--transfers",
    "16", // R2 handles high concurrency well
    "--checkers",
    "16", // Speed up the comparison phase
    "--s3-no-check-bucket", // Prevents an extra "Does this bucket exist?" call
    "--progress",
  ];

  if (CUSTOM_CA_CERT_PATH) {
    console.log(`Using custom CA certificate: ${CUSTOM_CA_CERT_PATH}`);
    args.push("--ca-cert", CUSTOM_CA_CERT_PATH);
  }

  return new Promise((resolve, reject) => {
    const child = spawn("rclone", args, { stdio: "inherit" });

    child.on("close", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`rclone exited with code ${code}`));
    });
  });
}

async function run() {
  try {
    await generateConfig();
    await runRclone();
    console.log("✅ All images synced successfully!");
  } catch (err) {
    if (err instanceof Error) {
      console.error("❌ Sync failed:", err.message);
    } else {
      console.error("❌ Sync failed:", err);
    }
    process.exit(1);
  }
}

run();
