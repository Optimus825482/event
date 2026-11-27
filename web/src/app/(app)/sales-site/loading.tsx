import { Skeleton } from "@/components/ui/skeleton";

export default function SalesSiteLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-5 w-80" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
