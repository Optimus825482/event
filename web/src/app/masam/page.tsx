import { FindTableForm } from "@/features/find-table/components/find-table-form";
import { FIND_TABLE_METADATA } from "@/features/find-table/page-meta";

export const metadata = FIND_TABLE_METADATA;
export const dynamic = "force-dynamic";

export default function FindTablePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 bg-background p-4 text-foreground">
      <FindTableForm />
    </main>
  );
}
