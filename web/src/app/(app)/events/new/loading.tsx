import { Skeleton } from "@/components/ui/skeleton";

export default function NewEventLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 max-w-2xl" />
      <Skeleton className="h-24 max-w-2xl" />
    </div>
  );
}
