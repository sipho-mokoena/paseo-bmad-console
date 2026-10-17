import path from "node:path";
import { CONSOLE_PACKAGE_NAME, type ConsoleMode } from "../shared/console";

/** The few filesystem reads validation needs, injectable for tests. */
export interface DirectoryFs {
  isDirectory(target: string): boolean;
  isFile(target: string): boolean;
  readText(target: string): string | null;
}

export type DirectoryCheck = { ok: true; directory: string } | { ok: false; message: string };

/**
 * Checks that `directory` is a usable checkout of the Paseo BMAD Console.
 * In `start` mode it also requires an existing production build.
 */
export function validateConsoleDirectory(
  directory: string,
  mode: ConsoleMode,
  fs: DirectoryFs,
): DirectoryCheck {
  const raw = directory.trim();
  if (raw === "") {
    return { ok: false, message: "Set the console directory in the plugin settings." };
  }
  if (raw.includes("\0") || !path.isAbsolute(raw)) {
    return { ok: false, message: "The console directory must be an absolute path." };
  }
  const dir = path.resolve(raw);
  if (!fs.isDirectory(dir)) {
    return { ok: false, message: `The console directory does not exist: ${dir}` };
  }
  const manifestText = fs.readText(path.join(dir, "package.json"));
  if (manifestText === null) {
    return { ok: false, message: `No package.json found in ${dir}.` };
  }
  let name: unknown;
  try {
    name = (JSON.parse(manifestText) as { name?: unknown }).name;
  } catch {
    return { ok: false, message: `package.json in ${dir} is not valid JSON.` };
  }
  if (name !== CONSOLE_PACKAGE_NAME) {
    return {
      ok: false,
      message: `${dir} is not the Paseo BMAD Console (package name must be "${CONSOLE_PACKAGE_NAME}").`,
    };
  }
  if (!fs.isFile(path.join(dir, "next.config.ts"))) {
    return { ok: false, message: `No next.config.ts found in ${dir}.` };
  }
  if (!fs.isFile(path.join(dir, "node_modules", "next", "package.json"))) {
    return {
      ok: false,
      message: `Dependencies are not installed in ${dir}. Run \`pnpm install\` there first.`,
    };
  }
  if (mode === "start" && !fs.isFile(path.join(dir, ".next", "BUILD_ID"))) {
    return {
      ok: false,
      message: `No production build found in ${path.join(dir, ".next")}. Run \`pnpm build\` in the console directory, or switch the mode to dev.`,
    };
  }
  return { ok: true, directory: dir };
}
