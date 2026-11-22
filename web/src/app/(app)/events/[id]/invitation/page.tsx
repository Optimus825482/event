import type { Metadata } from "next";
import Link from "next/link";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { designFrom } from "@/features/invitations/components/editor/editor-state";
import { EventInvitationEditor } from "@/features/invitations/components/event-invitation-editor";
import { SendPanel } from "@/features/invitations/components/send-panel";
import { parseStoredElements } from "@/features/invitations/elements";
import { loadEventInvitationPage } from "@/features/invitations/queries";

export const metadata: Metadata = { title: "E-davetiye | EventFlow" };

export default async function EventInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [actor, data] = await Promise.all([requirePolicyActor(), loadEventInvitationPage(id)]);
  const { event, layout, templates, recipients } = data;
  const canEdit = can(actor, "invitations", "edit");

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="space-y-1">
        <Link href={`/events/${event.id}`} className="text-sm text-muted-foreground hover:underline">
          {event.name}
        </Link>
        <h1 className="text-2xl font-semibold">E-davetiye tasarımı</h1>
      </div>

      {canEdit ? (
        <EventInvitationEditor
          eventId={event.id}
          eventName={event.name}
          eventDescription={event.description ?? ""}
          initial={designFrom(layout)}
          images={layout.eventImages}
          templateId={layout.templateId}
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            isDefault: t.isDefault,
            design: designFrom({
              width: t.width,
              height: t.height,
              backgroundColor: t.backgroundColor,
              backgroundGradient: t.backgroundGradient,
              backgroundImage: null,
              elements: parseStoredElements(t.elements),
            }),
          }))}
        />
      ) : (
        <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          Davetiye tasarımını düzenleme yetkiniz yok.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Davetiye gönder</h2>
        <p className="text-sm text-muted-foreground">
          Misafire e-postayla gönderin ya da WhatsApp bağlantısı oluşturun. Bağlantı yalnızca o misafirin davetiyesini gösterir.
        </p>
        <SendPanel recipients={recipients} canSend={canEdit} />
      </section>
    </div>
  );
}
