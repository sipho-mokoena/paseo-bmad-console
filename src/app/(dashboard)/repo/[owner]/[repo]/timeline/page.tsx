import { permanentRedirect } from "next/navigation";
import { timelineRedirectTarget } from "@/lib/timeline-params";

interface TimelineRedirectProps {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** The Timeline now lives on the Overview page; keep old links and bookmarks working, query included. */
export default async function TimelineRedirect({ params, searchParams }: TimelineRedirectProps) {
  const { owner, repo } = await params;
  permanentRedirect(timelineRedirectTarget(`/repo/${owner}/${repo}`, await searchParams));
}
