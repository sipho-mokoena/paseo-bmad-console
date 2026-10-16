import { Skeleton } from "@/components/ui/skeleton";

export default function EpicsLoading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
