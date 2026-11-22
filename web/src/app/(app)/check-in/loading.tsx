import { Skeleton } from "@/components/ui/skeleton";

export default function CheckInEventsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
