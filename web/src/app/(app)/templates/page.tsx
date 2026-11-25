import { Mail } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { TemplateList } from "@/features/invitations/components/template-list";
import { loadTemplates } from "@/features/invitations/queries";
import { canManageTemplate } from "@/features/invitations/templates";
import { isAdmin } from "@/features/auth/scope";

export const metadata: Metadata = { title: "Davetiye şablonları | EventFlow" };

export default async function TemplatesPage() {
  const [actor, templates] = await Promise.all([requirePolicyActor(), loadTemplates()]);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Davetiye şablonları"
        description="Etkinliklerde başlangıç noktası olarak kullanılan davetiye tasarımları."
        icon={<Mail className="h-8 w-8 text-blue-400" aria-hidden="true" />}
      />
      <TemplateList
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          size: t.size,
          isDefault: t.isDefault,
          isSystemTemplate: t.isSystemTemplate,
          canManage: canManageTemplate(actor, t),
        }))}
        isAdmin={isAdmin(actor)}
        canCreate={can(actor, "invitations", "create")}
        canEdit={can(actor, "invitations", "edit")}
        canDelete={can(actor, "invitations", "delete")}
      />
    </div>
  );
}
