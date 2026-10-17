import { Skeleton } from "@/components/ui/skeleton";

export default function TimelineLoading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-9 w-72 max-w-full rounded-lg" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
