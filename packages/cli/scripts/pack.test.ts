// scripts/ is outside the package tsconfig, so the editor does not load Bun's test types on its own.
/// <reference types="bun" />
import { expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

it("ships the init template without bundling the GitHub skill", () => {
  const temp = mkdtempSync(join(tmpdir(), "tiramisu-pack-"));
  try {
    // The test script builds first. Keep npm's cache and tarball inside this test's directory.
    const output = execFileSync(
      "npm",
      [
        "pack",
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        temp,
        "--cache",
        join(temp, "cache"),
      ],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        encoding: "utf8",
        shell: process.platform === "win32",
      },
    );
    const [pack] = JSON.parse(output) as { filename: string; files: { path: string }[] }[];
    const files = pack!.files.map((file) => file.path);
    expect(files).toContain("templates/AGENTS.md");
    expect(
      files.some((path) => path.startsWith("skills/") || path.startsWith("dist/skills/")),
    ).toBe(false);
    // Check the actual tarball so missing or stale templates fail before publishing.
    const packed = execFileSync(
      "tar",
      ["-xOf", join(temp, pack!.filename), "package/templates/AGENTS.md"],
      { encoding: "utf8" },
    );
    expect(packed).toBe(readFileSync(new URL("../templates/AGENTS.md", import.meta.url), "utf8"));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}, 30_000);
