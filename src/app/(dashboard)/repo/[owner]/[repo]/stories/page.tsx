import { permanentRedirect } from "next/navigation";
import { storiesRedirectTarget } from "@/lib/stories-browse";

interface StoriesRedirectProps {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ epic?: string | string[]; story?: string | string[] }>;
}

/** The Stories page was merged into Epics; keep old links and bookmarks working. */
export default async function StoriesRedirect({ params, searchParams }: StoriesRedirectProps) {
  const { owner, repo } = await params;
  const { epic, story } = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  permanentRedirect(
    storiesRedirectTarget(`/repo/${owner}/${repo}`, first(epic), first(story)),
  );
}
