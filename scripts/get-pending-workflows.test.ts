/// <reference types="bun" />
import { expect, it } from "bun:test";
import { getPendingWorkflows } from "./get-pending-workflows.mjs";

const workflows = [
  { id: 1, name: "CI" },
  { id: 2, name: "CodeQL" },
];

/** Models GitHub's latest run and its attempts for one workflow. */
function run({ id, number = 1, attempt = 1, status = "completed", conclusion = "success" }) {
  return { workflow_id: id, run_number: number, run_attempt: attempt, status, conclusion };
}

it("waits for a check that GitHub has not created yet", () => {
  expect(getPendingWorkflows({ runs: [run({ id: 1 })], workflows })).toEqual([
    { name: "CodeQL", status: "missing" },
  ]);
});

it("waits for a newer run even when an older one succeeded", () => {
  const runs = [run({ id: 1 }), run({ id: 1, number: 2, status: "queued" }), run({ id: 2 })];
  expect(getPendingWorkflows({ runs, workflows })).toEqual([{ name: "CI", status: "queued" }]);
});

it("waits for a rerun instead of using an earlier successful attempt", () => {
  const runs = [run({ id: 1 }), run({ id: 1, attempt: 2, status: "in_progress" }), run({ id: 2 })];
  expect(getPendingWorkflows({ runs, workflows })).toEqual([{ name: "CI", status: "in_progress" }]);
});

it("lets Scorecard assess failures and cancellations after checks finish", () => {
  const runs = [run({ id: 1, conclusion: "failure" }), run({ id: 2, conclusion: "cancelled" })];
  expect(getPendingWorkflows({ runs, workflows })).toEqual([]);
});

it("ignores completed unrelated workflows while required checks are still running", () => {
  const runs = [run({ id: 3 }), run({ id: 1 }), run({ id: 2, status: "in_progress" })];
  expect(getPendingWorkflows({ runs, workflows })).toEqual([
    { name: "CodeQL", status: "in_progress" },
  ]);
});
