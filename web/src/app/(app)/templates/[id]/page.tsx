import type { Metadata } from "next";
import Link from "next/link";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { designFrom } from "@/features/invitations/components/editor/editor-state";
import { TemplateEditor } from "@/features/invitations/components/template-editor";
import { INVITATION_SIZES, parseStoredElements } from "@/features/invitations/elements";
import { loadTemplate } from "@/features/invitations/queries";

export const metadata: Metadata = { title: "Şablon düzenle | EventFlow" };

export default async function TemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [actor, template] = await Promise.all([requirePolicyActor(), loadTemplate(id)]);
  const canEdit = can(actor, "invitations", "edit");
  const design = designFrom({
    width: template.width,
    height: template.height,
    backgroundColor: template.backgroundColor,
    backgroundGradient: template.backgroundGradient,
    backgroundImage: null,
    elements: parseStoredElements(template.elements),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Link href="/templates" className="text-sm text-muted-foreground hover:underline">
        Şablonlar
      </Link>
      <h1 className="text-2xl font-semibold">{template.name}</h1>
      <p className="text-sm text-muted-foreground">
        {INVITATION_SIZES[design.size].label}
        {template.isSystemTemplate ? " - sistem şablonu (silinemez)" : ""}
      </p>
      {canEdit ? (
        <TemplateEditor id={template.id} name={template.name} description={template.description ?? ""} initial={design} />
      ) : (
        <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">Bu şablonu düzenleme yetkiniz yok.</p>
      )}
    </div>
  );
}
