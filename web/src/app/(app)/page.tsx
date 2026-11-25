import { Shield } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModuleCard } from "@/components/dashboard/module-card";
import { EmptyState } from "@/components/layout/empty-state";
import { visibleNavGroups } from "@/features/auth/nav";
import { requirePolicyActor } from "@/features/auth/permissions";
import { landingFor, launcherModules } from "@/features/dashboard/modules";

export const metadata: Metadata = { title: "Modül Seçin | EventFlow" };

export default async function ModuleLauncherPage() {
  const actor = await requirePolicyActor();
  const landing = landingFor(actor);
  if (landing !== "/") redirect(landing);

  const modules = launcherModules(actor, visibleNavGroups(actor));

  if (modules.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl py-8">
        <EmptyState
          icon={<Shield aria-hidden="true" />}
          title="Henüz bir departmana atanmadınız"
          description="Erişim için sistem yöneticinize başvurun."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl py-4 sm:py-8">
      <div className="mb-8 text-center sm:mb-10 lg:mb-12">
        <h1 className="mb-2 text-2xl font-bold text-white sm:text-3xl lg:text-4xl">Modül Seçin</h1>
        <p className="text-sm text-slate-400 sm:text-base">Çalışmak istediğiniz modülü seçerek devam edin</p>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
        {modules.map((module) => (
          <li key={module.key}>
            <ModuleCard module={module} />
          </li>
        ))}
      </ul>
    </div>
  );
}
