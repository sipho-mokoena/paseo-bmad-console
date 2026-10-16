"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface BreadcrumbContextValue {
  /** Page-provided title (e.g. a story's "3.6 Title"); null falls back to the path-derived one. */
  title: string | null;
  setTitle: (title: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ title, setTitle }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error("useBreadcrumb must be used within a BreadcrumbProvider");
  }
  return ctx;
}

/** Renders nothing; gives the header a title that the URL alone cannot provide. */
export function BreadcrumbTitle({ title }: { title: string }) {
  const { setTitle } = useBreadcrumb();
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
  return null;
}
