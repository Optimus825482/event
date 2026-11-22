import { CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/ui/PageContainer";
import { NewEventWizard } from "@/features/events/components/new-event-wizard";
import { loadWizardOptions } from "@/features/events/queries";

export const metadata: Metadata = { title: "Yeni etkinlik | EventFlow" };

export default async function NewEventPage() {
  const options = await loadWizardOptions();

  return (
    <PageContainer maxWidth="4xl">
      <PageHeader
        title="Yeni etkinlik"
        description="Adım adım etkinlik oluşturun"
        icon={<CalendarPlus className="h-8 w-8 text-emerald-400" aria-hidden />}
      />
      <NewEventWizard {...options} />
    </PageContainer>
  );
}
