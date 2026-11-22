import { Skeleton } from "@/components/ui/skeleton";

export default function ReservationDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-52 w-52" />
      </div>
    </div>
  );
}
