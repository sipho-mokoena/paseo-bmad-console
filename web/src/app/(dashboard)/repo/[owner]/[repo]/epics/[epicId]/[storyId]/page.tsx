import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/shared/pill";
import { StoryDetailView } from "@/components/epics/story-detail-view";
import { StoryPager } from "@/components/epics/story-pager";
import { BreadcrumbTitle } from "@/contexts/breadcrumb-context";
import { decodeParam, loadProject } from "@/lib/load-project";
import {
  epicHref,
  epicsHref,
  neighbours,
  resolveAfter,
  storiesBlockedBy,
  storyHref,
} from "@/lib/stories-browse";

interface StoryPageProps {
  params: Promise<{ owner: string; repo: string; epicId: string; storyId: string }>;
}

const CRUMB =
  "inline-flex h-10 items-center rounded-md px-1 outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:h-7";

export default async function StoryPage({ params }: StoryPageProps) {
  const { owner, repo, epicId: rawEpic, storyId: rawStory } = await params;
  const epicId = decodeParam(rawEpic);
  const storyId = decodeParam(rawStory);
  const project = await loadProject(owner, repo);
  const epic = project.epics.find((e) => e.id === epicId);
  const story = project.stories.find((s) => s.epicId === epicId && s.id === storyId);
  if (!epic || !story) notFound();

  const base = `/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const inEpic = project.stories.filter((s) => s.epicId === epic.id);
  const { prev, next } = neighbours(inEpic, story.id);
  const target = (s: { id: string; title: string; epicId: string }) => ({
    id: s.id,
    title: s.title,
    href: storyHref(base, s.epicId, s.id),
  });

  const after = resolveAfter(project.stories, story.ticket?.after ?? []).map((r) => ({
    ref: r.ref,
    epicId: r.story?.epicId ?? null,
  }));
  const blocks = storiesBlockedBy(project.stories, story.id).map((s) => ({
    ref: s.id,
    epicId: s.epicId,
  }));

  return (
    <article className="min-w-0 space-y-5 px-2 pb-4" aria-label={`Story ${story.id}`}>
      <BreadcrumbTitle title={`${story.id} ${story.title}`} />
      <nav
        aria-label="Breadcrumb"
        className="-mx-1 flex flex-wrap items-center gap-x-0.5 text-[13px] text-muted-foreground"
      >
        <Link href={epicsHref(base)} className={CRUMB}>
          Epics
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <Link href={epicHref(base, epic.id)} className={CRUMB} title={epic.title}>
          Epic {epic.id}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span aria-current="page" className="px-1 font-mono text-xs">
          {story.id}
        </span>
      </nav>

      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{story.id}</span>
          <h1 className="min-w-0 break-words text-base font-medium">{story.title}</h1>
        </div>
        <div className="shrink-0 self-start">
          <StatusPill status={story.status} />
        </div>
      </header>

      <StoryDetailView story={story} base={base} after={after} blocks={blocks} />

      <StoryPager prev={prev ? target(prev) : null} next={next ? target(next) : null} />
    </article>
  );
}
