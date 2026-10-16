import {
  assertNoDevAuthBypassInProduction,
  warnIfDevAuthBypassActive,
} from "@/lib/auth/dev-bypass";

export function register() {
  // Fail fast: never start a production server with the login bypass configured.
  assertNoDevAuthBypassInProduction();
  warnIfDevAuthBypassActive();
}
