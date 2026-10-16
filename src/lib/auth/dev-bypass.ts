/**
 * Local-only "no login" mode (DEV_BYPASS_AUTH).
 *
 * This module is deliberately dependency-free: it is imported from the edge
 * middleware, from server code, from instrumentation and from next.config.ts.
 *
 * Rules:
 *  - The bypass is honoured only when NODE_ENV is not "production" AND
 *    DEV_BYPASS_AUTH is exactly "true".
 *  - In production, merely having DEV_BYPASS_AUTH set (to any non-empty value)
 *    is a fatal configuration error: `next build` and server start refuse to run.
 */

type Env = Record<string, string | undefined>;

let warned = false;

export function isDevAuthBypassEnabled(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" && env.DEV_BYPASS_AUTH === "true";
}

/** Throws when DEV_BYPASS_AUTH is set in a production environment. */
export function assertNoDevAuthBypassInProduction(env: Env = process.env): void {
  if (env.NODE_ENV === "production" && env.DEV_BYPASS_AUTH) {
    throw new Error(
      "DEV_BYPASS_AUTH is set while NODE_ENV=production. This flag disables login and is " +
        "for local development only. Unset DEV_BYPASS_AUTH and restart."
    );
  }
}

/** Logs a loud, one-time warning when the bypass is active. */
export function warnIfDevAuthBypassActive(env: Env = process.env): void {
  if (warned || !isDevAuthBypassEnabled(env)) return;
  warned = true;
  console.warn(
    "\n" +
      "!!! DEV_BYPASS_AUTH=true: authentication is DISABLED. Every request acts as a local admin. !!!\n" +
      "!!! Use this only on a trusted local machine, never on a shared or public host.            !!!\n"
  );
}

/** Test helper: reset the one-time warning flag. */
export function resetDevAuthBypassWarning(): void {
  warned = false;
}
