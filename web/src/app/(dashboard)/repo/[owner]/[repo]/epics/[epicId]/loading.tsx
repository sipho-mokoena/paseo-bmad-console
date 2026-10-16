import { Skeleton } from "@/components/ui/skeleton";

export default function EpicLoading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="space-y-2 px-2">
        <Skeleton className="h-5 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-2 w-full" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
