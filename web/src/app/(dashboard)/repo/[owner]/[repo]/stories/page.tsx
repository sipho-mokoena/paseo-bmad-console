import { permanentRedirect } from "next/navigation";
import { storiesRedirectTarget } from "@/lib/stories-browse";

interface StoriesRedirectProps {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ epic?: string | string[] }>;
}

/** The Stories page was merged into Epics; keep old links and bookmarks working. */
export default async function StoriesRedirect({ params, searchParams }: StoriesRedirectProps) {
  const { owner, repo } = await params;
  const { epic } = await searchParams;
  permanentRedirect(
    storiesRedirectTarget(`/repo/${owner}/${repo}`, Array.isArray(epic) ? epic[0] : epic),
  );
}
