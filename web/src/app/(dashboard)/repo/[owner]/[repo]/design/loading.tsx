import { Skeleton } from "@/components/ui/skeleton";

export default function DesignLoading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <div className="space-y-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
