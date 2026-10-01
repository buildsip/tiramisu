import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { getPendingWorkflows } from "./get-pending-workflows.mjs";

/** Reads GitHub's API with the workflow token; gh handles authentication without printing it. */
function readGitHub({ path }) {
  try {
    return JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8", timeout: 30_000 }));
  } catch (error) {
    throw new Error(
      `Could not read GitHub checks. Give this job contents: read, actions: read, and pull-requests: read permissions, then rerun Scorecard. ${error.stderr?.toString().trim() ?? error.message}`,
    );
  }
}

/** Waits for main and its merged PR so Scorecard sees completed checks instead of an in-progress run. */
async function waitForChecks(ctx) {
  const repo = process.env.GH_REPO;
  const sha = process.env.CHECK_SHA;
  if (!repo || !sha || !process.env.GH_TOKEN) {
    throw new Error(
      "Set GH_REPO to owner/repository, CHECK_SHA to the commit, and GH_TOKEN to the workflow token, then rerun Scorecard.",
    );
  }
  const path = `repos/${repo}`;
  const workflows = readGitHub({ path: `${path}/actions/workflows?per_page=100` }).workflows.filter(
    (workflow) => workflow.name === "CI" || workflow.name === "CodeQL",
  );
  if (workflows.length !== 2 || workflows.some((workflow) => workflow.state !== "active")) {
    throw new Error("Enable the CI and CodeQL workflows in GitHub Actions, then rerun Scorecard.");
  }

  // Squash merges have a different SHA from their PR head. Scorecard inspects the PR's checks.
  const pulls = readGitHub({ path: `${path}/commits/${sha}/pulls?per_page=100` });
  const heads = new Set([
    sha,
    ...pulls
      .filter((pull) => pull.merged_at && pull.merge_commit_sha === sha)
      .map((pull) => pull.head.sha),
  ]);
  // The docs CI job allows 30 minutes. Give it its full window before reporting a stalled run.
  const deadline = Date.now() + 30 * 60_000;
  while (true) {
    const pending = [...heads].flatMap((head) => {
      const runs = readGitHub({
        path: `${path}/actions/runs?head_sha=${head}&per_page=100`,
      }).workflow_runs;
      return getPendingWorkflows({ runs, workflows }).map(
        (workflow) => `${workflow.name} on ${head.slice(0, 7)} (${workflow.status})`,
      );
    });
    if (!pending.length) {
      // Do not require success here: Scorecard must still report genuinely failed checks.
      ctx.log("CI and CodeQL have completed. Scorecard can now assess their results.");
      return;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Checks did not finish within thirty minutes: ${pending.join(", ")}. Open GitHub Actions, finish or rerun those checks, then rerun Scorecard.`,
      );
    }
    ctx.log(`Waiting for ${pending.join(", ")}.`);
    await setTimeout(10_000);
  }
}

try {
  await waitForChecks({ log: console.log });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
