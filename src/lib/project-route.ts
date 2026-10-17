function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** `/repo/<owner>/<repo>[/...]` gives the project; any other route gives null. */
export function projectFromPathname(pathname: string): { owner: string; name: string } | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "repo" || segments.length < 3) return null;
  return { owner: safeDecode(segments[1]), name: safeDecode(segments[2]) };
}
