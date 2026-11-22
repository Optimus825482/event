import type { Metadata } from "next";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { TemplateList } from "@/features/invitations/components/template-list";
import { loadTemplates } from "@/features/invitations/queries";

export const metadata: Metadata = { title: "Davetiye şablonları | EventFlow" };

export default async function TemplatesPage() {
  const [actor, templates] = await Promise.all([requirePolicyActor(), loadTemplates()]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Davetiye şablonları</h1>
        <p className="text-sm text-muted-foreground">Etkinliklerde başlangıç noktası olarak kullanılan davetiye tasarımları.</p>
      </div>
      <TemplateList
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          size: t.size,
          isDefault: t.isDefault,
          isSystemTemplate: t.isSystemTemplate,
        }))}
        canCreate={can(actor, "invitations", "create")}
        canEdit={can(actor, "invitations", "edit")}
        canDelete={can(actor, "invitations", "delete")}
      />
    </div>
  );
}
