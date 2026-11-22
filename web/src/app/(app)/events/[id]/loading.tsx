import { Skeleton } from "@/components/ui/skeleton";

export default function EventDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-5 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}
