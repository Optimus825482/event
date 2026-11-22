import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-6xl space-y-4">
      <span className="sr-only">Misafirler yükleniyor…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
