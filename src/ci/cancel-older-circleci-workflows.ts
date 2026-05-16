const API_BASE_URL = "https://circleci.com/api/v2";
const RUNNING_WORKFLOW_STATUSES = new Set(["running", "on_hold", "failing"]);

interface CircleCiPipelineListResponse {
  items: CircleCiPipeline[];
  next_page_token: string | null;
}

interface CircleCiPipeline {
  id: string;
  number: number;
  vcs?: {
    branch?: string;
    revision?: string;
  };
}

interface CircleCiWorkflowListResponse {
  items: CircleCiWorkflow[];
  next_page_token: string | null;
}

interface CircleCiWorkflow {
  id: string;
  name: string;
  status: string;
}

interface ScriptOptions {
  token: string;
  projectSlug: string;
  branch: string;
  currentPipelineNumber: number;
  currentWorkflowId: string;
}

/**
 * Reads the CircleCI environment required to cancel older workflows for this branch.
 *
 * @returns The validated script options.
 */
function readOptions(): ScriptOptions {
  const token = process.env.CIRCLECI_API_TOKEN;
  const projectUsername = process.env.CIRCLE_PROJECT_USERNAME;
  const projectName = process.env.CIRCLE_PROJECT_REPONAME;
  const branch = process.env.CIRCLE_BRANCH;
  const currentPipelineNumber = Number(process.env.CIRCLE_PIPELINE_NUMBER);
  const currentWorkflowId = process.env.CIRCLE_WORKFLOW_ID;

  if (!token) {
    throw new Error("Missing CIRCLECI_API_TOKEN environment variable.");
  }

  if (!projectUsername || !projectName) {
    throw new Error(
      "Missing CIRCLE_PROJECT_USERNAME or CIRCLE_PROJECT_REPONAME environment variable.",
    );
  }

  if (!branch) {
    throw new Error("Missing CIRCLE_BRANCH environment variable.");
  }

  if (!Number.isInteger(currentPipelineNumber)) {
    throw new Error("Missing or invalid CIRCLE_PIPELINE_NUMBER environment variable.");
  }

  if (!currentWorkflowId) {
    throw new Error("Missing CIRCLE_WORKFLOW_ID environment variable.");
  }

  return {
    token,
    projectSlug: `gh/${projectUsername}/${projectName}`,
    branch,
    currentPipelineNumber,
    currentWorkflowId,
  };
}

/**
 * Fetches all recent CircleCI pipelines for the current branch.
 *
 * @param options - The CircleCI project and authentication options.
 * @returns The branch pipelines returned by CircleCI.
 */
async function listBranchPipelines(options: ScriptOptions): Promise<CircleCiPipeline[]> {
  const pipelines: CircleCiPipeline[] = [];
  let nextPageToken: string | null = null;

  do {
    const url = new URL(`${API_BASE_URL}/project/${options.projectSlug}/pipeline`);
    url.searchParams.set("branch", options.branch);

    if (nextPageToken) {
      url.searchParams.set("page-token", nextPageToken);
    }

    const body = await requestJson<CircleCiPipelineListResponse>(options, url, "GET");
    pipelines.push(...body.items);
    nextPageToken = body.next_page_token;
  } while (nextPageToken);

  return pipelines;
}

/**
 * Fetches all workflows for a CircleCI pipeline.
 *
 * @param options - The CircleCI project and authentication options.
 * @param pipelineId - The CircleCI pipeline ID.
 * @returns Workflows associated with the pipeline.
 */
async function listPipelineWorkflows(
  options: ScriptOptions,
  pipelineId: string,
): Promise<CircleCiWorkflow[]> {
  const workflows: CircleCiWorkflow[] = [];
  let nextPageToken: string | null = null;

  do {
    const url = new URL(`${API_BASE_URL}/pipeline/${pipelineId}/workflow`);

    if (nextPageToken) {
      url.searchParams.set("page-token", nextPageToken);
    }

    const body = await requestJson<CircleCiWorkflowListResponse>(options, url, "GET");
    workflows.push(...body.items);
    nextPageToken = body.next_page_token;
  } while (nextPageToken);

  return workflows;
}

/**
 * Cancels a CircleCI workflow.
 *
 * @param options - The CircleCI project and authentication options.
 * @param workflowId - The workflow ID to cancel.
 */
async function cancelWorkflow(options: ScriptOptions, workflowId: string): Promise<void> {
  const url = new URL(`${API_BASE_URL}/workflow/${workflowId}/cancel`);
  await requestJson(options, url, "POST");
}

/**
 * Sends an authenticated CircleCI API request and parses its JSON response.
 *
 * @param options - The CircleCI authentication options.
 * @param url - The request URL.
 * @param method - The HTTP method.
 * @returns The parsed JSON response body.
 */
async function requestJson<T>(
  options: ScriptOptions,
  url: URL,
  method: "GET" | "POST",
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      "Circle-Token": options.token,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`CircleCI API ${method} ${url.pathname} failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

/**
 * Cancels running workflows from older pipelines for the current branch.
 */
async function run(): Promise<void> {
  const options = readOptions();
  const pipelines = await listBranchPipelines(options);
  const olderPipelines = pipelines.filter(
    (pipeline) =>
      pipeline.number < options.currentPipelineNumber && pipeline.vcs?.branch === options.branch,
  );

  if (olderPipelines.length === 0) {
    console.log(`No older pipelines found for ${options.branch}.`);
    return;
  }

  let cancelledCount = 0;

  for (const pipeline of olderPipelines) {
    const workflows = await listPipelineWorkflows(options, pipeline.id);

    for (const workflow of workflows) {
      if (
        workflow.id === options.currentWorkflowId ||
        !RUNNING_WORKFLOW_STATUSES.has(workflow.status)
      ) {
        continue;
      }

      await cancelWorkflow(options, workflow.id);
      cancelledCount += 1;
      console.log(
        `Cancelled workflow ${workflow.name} (${workflow.id}) from older pipeline ${pipeline.number}.`,
      );
    }
  }

  console.log(`Cancelled ${cancelledCount} older workflow(s) for ${options.branch}.`);
}

run().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});
