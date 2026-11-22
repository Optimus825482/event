import { Skeleton } from "@/components/ui/skeleton";

export default function CheckInConsoleLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
