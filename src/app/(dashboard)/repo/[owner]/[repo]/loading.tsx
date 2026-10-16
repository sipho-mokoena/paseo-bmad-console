import { Skeleton } from "@/components/ui/skeleton";

export default function RepoOverviewLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <div className="space-y-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
