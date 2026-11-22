import { Skeleton } from "@/components/ui/skeleton";

export default function AssignmentImportLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
