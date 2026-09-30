import { cancelInit } from "./cancel-init";

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { confirm, isCancel, type log } from "@clack/prompts";
import { gt, valid } from "semver";
import { CLI_NAME } from "./cli-name";
import { getPackageManager } from "./get-package-manager";
import { NAMES } from "./names";
import { isSourceCheckout } from "./is-source-checkout";

/**
 * Installs the global CLI through the package manager that launched this process.
 * Keeps an existing install unless a newer release is accepted, falling back to npm
 * for modern Yarn.
 * Source checkouts rebuild and link through Bun; published packages use the registry.
 * Private packages also stay local.
 */
export async function installCli(
  ctx: { log: Pick<typeof log, "info" | "warn" | "step"> },
  { cwd, cliRoot, verbose = false }: { cwd: string; cliRoot: string; verbose?: boolean },
) {
  const cli = JSON.parse(readFileSync(join(cliRoot, "package.json"), "utf8"));
  const options = {
    cwd,
    encoding: "utf8" as const,
    // These are stdin, stdout, stderr: no input, and capture both output streams as text.
    stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"],
    // Windows package managers commonly launch through .cmd files, which need a shell.
    shell: process.platform === "win32",
  };
  if (isSourceCheckout({ root: cliRoot })) {
    // Use the CLI's source directory, not the repository being initialized.
    // Refresh the link on every setup: development changes do not bump the package version.
    const local = { ...options, cwd: cliRoot, stdio: verbose ? "inherit" : "pipe" } as const;
    try {
      ctx.log.step(`Building local ${cli.name} CLI.`);
      execFileSync("bun", ["run", "build"], local);
    } catch {
      throw new Error(
        `Could not build the local tiramisu CLI. Run bun install in the source repository, then run bun run build in ${cliRoot} and fix the reported errors. Retry ${CLI_NAME} init --verbose after the build succeeds.`,
      );
    }
    try {
      ctx.log.step(`Linking local ${cli.name} CLI globally.`);
      // Register this directory and its bin directly, without reinstalling workspace dependencies.
      execFileSync("bun", ["link"], local);
    } catch {
      throw new Error(
        `Could not link the local tiramisu CLI. Run bun link in ${cliRoot} to see Bun's error and check write access to its global install directory. Retry ${CLI_NAME} init --verbose after linking succeeds.`,
      );
    }
    return;
  }
  const launcher = getPackageManager();
  let packageManager = launcher.name;
  if (packageManager === "yarn") {
    const version = launcher.version;
    if (!version || !valid(version) || gt(version, "2.0.0-0")) {
      ctx.log.info(
        "This Yarn version does not support global installs. Using npm for the global CLI.",
      );
      packageManager = "npm";
    }
  }
  let globalRoot: string | undefined;
  if (packageManager === "bun") {
    // Bun reports its configured global directory in the listing, including custom bunfig paths.
    try {
      const list = execFileSync("bun", ["pm", "ls", "-g"], options);
      const path = list.split("\n")[0]?.match(/^(.*) node_modules(?: \(.*\))?$/)?.[1];
      if (!path || !isAbsolute(path)) throw new Error("Could not locate Bun's global packages.");
      globalRoot = join(path, NAMES.NODE_MODULES);
    } catch (error) {
      // Fresh and linked-only Bun global directories can have no lockfile.
      // Let the global add command create it instead of aborting setup.
      const stderr = String((error as { stderr?: unknown }).stderr ?? "");
      if (
        !stderr.includes("No package.json was found for directory") &&
        !stderr.includes("missing lockfile, nothing to list")
      )
        throw error;
    }
  } else {
    globalRoot = execFileSync(
      packageManager,
      packageManager === "yarn" ? ["global", "dir", "--silent"] : ["root", "-g"],
      options,
    ).trim();
    if (packageManager === "yarn") globalRoot = join(globalRoot, NAMES.NODE_MODULES);
  }
  const installedPath = globalRoot && join(globalRoot, cli.name, "package.json");
  const installed =
    installedPath && existsSync(installedPath)
      ? JSON.parse(readFileSync(installedPath, "utf8"))
      : undefined;
  // An unrelated package published under the same name will not expose this bin.
  if (installed && (!valid(installed.version) || typeof installed.bin?.[CLI_NAME] !== "string"))
    throw new Error(
      `The global ${cli.name} package is not this CLI. Resolve that package name conflict before initializing.`,
    );
  let version: string = cli.version;
  let install = !installed;
  let latest = version;
  // Private development packages must never resolve the unrelated public npm placeholder name.
  if (!cli.private) {
    try {
      const result = JSON.parse(
        execFileSync(
          packageManager,
          [
            packageManager === "yarn" || packageManager === "bun" ? "info" : "view",
            cli.name,
            "version",
            "--json",
          ],
          { ...options, timeout: 5000 },
        ),
      );
      const release = packageManager === "yarn" ? result.data : result;
      if (valid(release) && gt(release, latest)) latest = release;
    } catch {
      ctx.log.warn("Could not check for a newer CLI release. Using the running version.");
    }
  }
  if (gt(latest, installed?.version ?? version)) {
    const upgrade = await confirm({
      message: `Upgrade ${cli.name} from ${installed?.version ?? version} to ${latest}?`,
      initialValue: true,
    });
    if (isCancel(upgrade)) cancelInit();
    if (upgrade) {
      version = latest;
      install = true;
    }
  }
  if (install) {
    ctx.log.step(`Installing ${cli.name} ${version} globally.`);
    const spec = cli.private ? cliRoot : `${cli.name}@${version}`;
    const args =
      packageManager === "yarn"
        ? ["global", "add", spec]
        : packageManager === "npm"
          ? ["install", "--global", spec]
          : ["add", "-g", spec];
    try {
      execFileSync(packageManager, args, { ...options, stdio: verbose ? "inherit" : "pipe" });
    } catch (error) {
      // Package managers can install files before failing. Keep their output to explain why.
      // With --verbose the streams are inherited, so fall back to the process error message.
      const failure = error as {
        stderr?: string | Buffer;
        stdout?: string | Buffer;
        message?: string;
      };
      const details =
        String(failure?.stderr ?? "").trim() ||
        String(failure?.stdout ?? "").trim() ||
        failure?.message ||
        String(error);
      throw new Error(
        `Could not install ${cli.name} globally with ${packageManager}. Resolve the package manager error below, then retry ${CLI_NAME} init --verbose.\n\n${details}`,
        { cause: error },
      );
    }
  }
}
