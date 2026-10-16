import { Skeleton } from "@/components/ui/skeleton";

export default function StoryLoading() {
  return (
    <div className="space-y-5 px-2" aria-busy="true">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-6 w-96 max-w-full" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
