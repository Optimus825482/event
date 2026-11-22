import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { designFrom } from "@/features/invitations/components/editor/editor-state";
import { TemplateEditor } from "@/features/invitations/components/template-editor";
import { INVITATION_SIZES, parseStoredElements } from "@/features/invitations/elements";
import { loadTemplate } from "@/features/invitations/queries";
import { canManageTemplate } from "@/features/invitations/templates";

export const metadata: Metadata = { title: "Şablon düzenle | EventFlow" };

export default async function TemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [actor, template] = await Promise.all([requirePolicyActor(), loadTemplate(id)]);
  const canEdit = can(actor, "invitations", "edit") && canManageTemplate(actor, template);
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
      <Link href="/templates" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Şablonlar
      </Link>
      <PageHeader
        className="mb-2"
        title={template.name}
        description={`${INVITATION_SIZES[design.size].label}${template.isSystemTemplate ? " - sistem şablonu (silinemez)" : ""}`}
      />
      {canEdit ? (
        <TemplateEditor id={template.id} name={template.name} description={template.description ?? ""} initial={design} />
      ) : (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">Bu şablonu düzenleme yetkiniz yok.</p>
      )}
    </div>
  );
}
