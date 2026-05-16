const API_BASE_URL = "https://api.cloudflare.com/client/v4";

interface CloudflareListDeploymentsResponse {
  success: boolean;
  errors: CloudflareApiMessage[];
  result: CloudflarePagesDeployment[];
  result_info?: {
    page: number;
    per_page: number;
    total_pages: number;
  };
}

interface CloudflareDeleteDeploymentResponse {
  success: boolean;
  errors: CloudflareApiMessage[];
}

interface CloudflareApiMessage {
  code: number;
  message: string;
}

interface CloudflarePagesDeployment {
  id: string;
  url: string;
  created_on: string;
  environment?: string;
  deployment_trigger?: {
    metadata?: {
      branch?: string;
      commit_hash?: string;
      commit_message?: string;
    };
  };
}

interface ScriptOptions {
  accountId: string;
  apiToken: string;
  projectName: string;
  dryRun: boolean;
}

/**
 * Reads and validates the options needed to delete a Cloudflare Pages deployment.
 *
 * @returns The validated script options.
 */
function readOptions(): ScriptOptions {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId) {
    throw new Error("Missing CLOUDFLARE_ACCOUNT_ID environment variable.");
  }

  if (!apiToken) {
    throw new Error("Missing CLOUDFLARE_API_TOKEN environment variable.");
  }

  return {
    accountId,
    apiToken,
    projectName: readArgValue("--project-name") ?? process.env.CLOUDFLARE_PAGES_PROJECT_NAME ?? "",
    dryRun: Bun.argv.includes("--dry-run"),
  };
}

/**
 * Reads a command-line option value in the form `--name value` or `--name=value`.
 *
 * @param name - The option name to read.
 * @returns The option value when present.
 */
function readArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inlineArg = Bun.argv.find((arg) => arg.startsWith(prefix));

  if (inlineArg) {
    return inlineArg.slice(prefix.length);
  }

  const argIndex = Bun.argv.indexOf(name);

  if (argIndex === -1) {
    return undefined;
  }

  return Bun.argv[argIndex + 1];
}

/**
 * Fetches every deployment for the configured Cloudflare Pages project.
 *
 * @param options - The Cloudflare API and project options.
 * @returns All deployments returned by the paginated Cloudflare API.
 */
async function listDeployments(options: ScriptOptions): Promise<CloudflarePagesDeployment[]> {
  const deployments: CloudflarePagesDeployment[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = new URL(
      `${API_BASE_URL}/accounts/${options.accountId}/pages/projects/${options.projectName}/deployments`,
    );
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "25");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${options.apiToken}`,
      },
    });

    const body = (await response.json()) as CloudflareListDeploymentsResponse;

    if (!response.ok || !body.success) {
      throw new Error(`Failed to list deployments: ${formatCloudflareErrors(body.errors)}`);
    }

    deployments.push(...body.result);
    totalPages = body.result_info?.total_pages ?? page;
    page += 1;
  }

  return deployments;
}

/**
 * Selects the oldest deployment by creation timestamp.
 *
 * @param deployments - The deployments to inspect.
 * @returns The oldest deployment, or undefined when the project has no deployments.
 */
function findOldestDeployment(
  deployments: CloudflarePagesDeployment[],
): CloudflarePagesDeployment | undefined {
  return deployments.toSorted(
    (left, right) => Date.parse(left.created_on) - Date.parse(right.created_on),
  )[0];
}

/**
 * Deletes one Cloudflare Pages deployment.
 *
 * @param options - The Cloudflare API and project options.
 * @param deploymentId - The deployment ID to delete.
 */
async function deleteDeployment(options: ScriptOptions, deploymentId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/accounts/${options.accountId}/pages/projects/${options.projectName}/deployments/${deploymentId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${options.apiToken}`,
      },
    },
  );

  const body = (await response.json()) as CloudflareDeleteDeploymentResponse;

  if (!response.ok || !body.success) {
    throw new Error(`Failed to delete deployment: ${formatCloudflareErrors(body.errors)}`);
  }
}

/**
 * Formats Cloudflare API errors for terminal output without exposing credentials.
 *
 * @param errors - The Cloudflare API errors.
 * @returns A readable error string.
 */
function formatCloudflareErrors(errors: CloudflareApiMessage[] | undefined): string {
  if (!errors || errors.length === 0) {
    return "Unknown Cloudflare API error.";
  }

  return errors.map((error) => `${error.code}: ${error.message}`).join("; ");
}

/**
 * Prints the deployment selected for deletion.
 *
 * @param deployment - The selected deployment.
 */
function logDeployment(deployment: CloudflarePagesDeployment): void {
  const metadata = deployment.deployment_trigger?.metadata;

  console.log(`Deployment ID: ${deployment.id}`);
  console.log(`Created on: ${deployment.created_on}`);
  console.log(`Environment: ${deployment.environment ?? "unknown"}`);
  console.log(`Branch: ${metadata?.branch ?? "unknown"}`);
  console.log(`Commit: ${metadata?.commit_hash ?? "unknown"}`);
  console.log(`URL: ${deployment.url}`);
}

/**
 * Deletes the oldest Cloudflare Pages deployment for the configured project.
 */
async function run(): Promise<void> {
  const options = readOptions();
  const deployments = await listDeployments(options);
  const oldestDeployment = findOldestDeployment(deployments);

  if (!oldestDeployment) {
    console.log(`No deployments found for project ${options.projectName}.`);
    return;
  }

  console.log(`Oldest deployment for project ${options.projectName}:`);
  logDeployment(oldestDeployment);

  if (options.dryRun) {
    console.log("Dry run enabled; no deployment was deleted.");
    return;
  }

  await deleteDeployment(options, oldestDeployment.id);
  console.log("Oldest deployment deleted.");
}

run().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});
