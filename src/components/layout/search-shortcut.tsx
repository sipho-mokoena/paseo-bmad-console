"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** "/" or Ctrl/Cmd+K anywhere in the dashboard opens (or focuses) the Search screen. */
export function SearchShortcut() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      const isK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      const isSlash = e.key === "/" && !e.ctrlKey && !e.metaKey && !typing;
      if (!isK && !isSlash) return;
      e.preventDefault();
      if (pathname.startsWith("/search")) {
        document.querySelector<HTMLInputElement>('[role="search"] input')?.focus();
      } else {
        router.push("/search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);

  return null;
}
