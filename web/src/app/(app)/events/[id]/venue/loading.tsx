import { Skeleton } from "@/components/ui/skeleton";

export default function EventVenueLoading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[60vh] w-full" />
    </div>
  );
}
