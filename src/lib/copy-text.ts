export interface CopyEnv {
  /** Async clipboard API; undefined on insecure contexts (plain http). */
  clipboard?: { writeText(text: string): Promise<void> } | null;
  /** Synchronous fallback (hidden textarea + execCommand). Returns success. */
  exec?: (text: string) => boolean;
}

/** Legacy copy through a hidden textarea; works on plain http where `navigator.clipboard` is missing. */
export function execCommandCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "-9999px";
  area.style.opacity = "0";
  const active = document.activeElement as HTMLElement | null;
  document.body.appendChild(area);
  try {
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
    active?.focus?.();
  }
}

function browserEnv(): CopyEnv {
  return {
    clipboard: typeof navigator !== "undefined" ? navigator.clipboard : undefined,
    exec: execCommandCopy,
  };
}

/** Copy text to the clipboard. Resolves true on success, false when every method failed. */
export async function copyText(text: string, env: CopyEnv = browserEnv()): Promise<boolean> {
  if (env.clipboard) {
    try {
      await env.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the legacy path */
    }
  }
  try {
    return env.exec ? env.exec(text) : false;
  } catch {
    return false;
  }
}
