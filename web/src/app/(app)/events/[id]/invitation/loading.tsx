import { Skeleton } from "@/components/ui/skeleton";

export default function EventInvitationLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[480px] w-full" />
        <Skeleton className="h-[480px] w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
