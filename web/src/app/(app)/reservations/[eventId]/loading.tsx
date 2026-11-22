import { Skeleton } from "@/components/ui/skeleton";

export default function EventReservationsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-5 w-96" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
