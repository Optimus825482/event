import { Skeleton } from "@/components/ui/skeleton";

export default function TeamOrganizationLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-busy="true">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-2 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
