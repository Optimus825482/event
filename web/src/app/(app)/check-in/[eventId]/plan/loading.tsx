import { Skeleton } from "@/components/ui/skeleton";

export default function CheckInPlanLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[520px] w-full" />
    </div>
  );
}
