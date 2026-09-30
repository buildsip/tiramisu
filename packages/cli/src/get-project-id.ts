import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Hashes the remote, environment fallback, or repo root with a private local salt. */
export async function getProjectId({ repo, salt }: { repo: string; salt: string }) {
  let remote: string | undefined;
  try {
    // Read local Git configuration without a shell or a network request.
    const { stdout } = await exec(
      "git",
      ["-C", repo, "config", "--local", "--get", "remote.origin.url"],
      { timeout: 1_000, windowsHide: true, maxBuffer: 64 * 1024 },
    );
    remote = stdout.trim();
  } catch {
    // Repositories without a remote still get a stable ID from the fallbacks.
  }
  const value = remote || process.env.REPOSITORY_URL || repo;
  // The local salt prevents matching this hash against a list of known public remotes.
  return createHash("sha256").update(salt).update(value).digest("hex");
}
