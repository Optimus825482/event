import { Skeleton } from "@/components/ui/skeleton";

export default function ReviewBoardLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4" aria-busy="true">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
