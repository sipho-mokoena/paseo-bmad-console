import path from "node:path";
import { CONSOLE_PACKAGE_NAME } from "../shared/console";

/** The few filesystem reads validation needs, injectable for tests. */
export interface DirectoryFs {
  isDirectory(target: string): boolean;
  isFile(target: string): boolean;
  readText(target: string): string | null;
}

export type DirectoryCheck =
  | {
      ok: true;
      /** The install folder as configured. The `.env` file lives here. */
      directory: string;
      /** The folder that holds `server.js`: the install folder itself, or its `app` folder. */
      appDir: string;
      envFile: string;
    }
  | { ok: false; message: string };

export const INSTALL_HINT = "Run `pnpm deploy:local` in a checkout of the console to install it.";

/**
 * Checks that `directory` holds an installed build of the Paseo BMAD Console: a Next.js
 * standalone build (`server.js` and `.next/BUILD_ID`), either directly in the folder or in its
 * `app` folder. No source tree and no `node_modules` install are needed or used.
 */
export function validateConsoleDirectory(directory: string, fs: DirectoryFs): DirectoryCheck {
  const raw = directory.trim();
  if (raw === "") {
    return { ok: false, message: `The console is not installed. ${INSTALL_HINT}` };
  }
  if (raw.includes("\0") || !path.isAbsolute(raw)) {
    return { ok: false, message: "The console folder must be an absolute path." };
  }
  const dir = path.resolve(raw);
  if (!fs.isDirectory(dir)) {
    return { ok: false, message: `The console is not installed in ${dir}. ${INSTALL_HINT}` };
  }
  const appDir = fs.isFile(path.join(dir, "server.js")) ? dir : path.join(dir, "app");
  if (!fs.isFile(path.join(appDir, "server.js"))) {
    return { ok: false, message: `No installed console found in ${dir}. ${INSTALL_HINT}` };
  }
  if (!fs.isFile(path.join(appDir, ".next", "BUILD_ID"))) {
    return { ok: false, message: `The build in ${appDir} is incomplete. ${INSTALL_HINT}` };
  }
  const manifestText = fs.readText(path.join(appDir, "package.json"));
  if (manifestText !== null) {
    try {
      const name = (JSON.parse(manifestText) as { name?: unknown }).name;
      if (typeof name === "string" && name !== CONSOLE_PACKAGE_NAME) {
        return { ok: false, message: `${appDir} is not the Paseo BMAD Console (package name must be "${CONSOLE_PACKAGE_NAME}").` };
      }
    } catch {
      return { ok: false, message: `package.json in ${appDir} is not valid JSON.` };
    }
  }
  return { ok: true, directory: dir, appDir, envFile: path.join(dir, ".env") };
}
