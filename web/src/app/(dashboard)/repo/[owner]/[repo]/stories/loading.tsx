import { Skeleton } from "@/components/ui/skeleton";

export default function StoriesLoading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
