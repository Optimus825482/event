import { PageContainer } from "@/components/ui/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceLoading() {
  return (
    <PageContainer>
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    </PageContainer>
  );
}
