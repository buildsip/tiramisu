/** Finds workflows whose latest run is missing or still running. Failed runs count as completed. */
export function getPendingWorkflows({ runs, workflows }) {
  return workflows.flatMap((workflow) => {
    // A completed older run must not hide a newer queued run or rerun for the same commit.
    const latest = runs
      .filter((run) => run.workflow_id === workflow.id)
      .sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
    return latest?.status === "completed"
      ? []
      : [{ name: workflow.name, status: latest?.status ?? "missing" }];
  });
}
