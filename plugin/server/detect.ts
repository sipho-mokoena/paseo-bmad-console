import path from "node:path";
import type { NetworkInterfaceInfo } from "node:os";

/** Where the console is installed by default: build output only, outside any source checkout. */
export const INSTALL_DIR_PARTS = [".paseo", "bmad-console"] as const;

export function defaultInstallDirectory(home: string): string {
  return path.join(home, ...INSTALL_DIR_PARTS);
}

/**
 * The address of this machine other devices should use: a Tailscale address first, then a
 * private LAN address. Null when the machine has no external IPv4 address.
 */
export function pickNetworkAddress(interfaces: Record<string, readonly NetworkInterfaceInfo[] | undefined>): string | null {
  const addresses = Object.values(interfaces)
    .flatMap((list) => list ?? [])
    .filter((info) => info.family === "IPv4" && !info.internal)
    .map((info) => info.address);
  const rank = (address: string): number => {
    const [a, b] = address.split(".").map(Number);
    if (a === 100 && b >= 64 && b <= 127) return 0;
    if (a === 192 && b === 168) return 1;
    if (a === 10) return 1;
    if (a === 172 && b >= 16 && b <= 31) return 1;
    return 2;
  };
  const sorted = [...addresses].sort((x, y) => rank(x) - rank(y));
  return sorted[0] ?? null;
}
