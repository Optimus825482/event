import type { Metadata } from "next";
import { Mail, Phone, ShieldCheck, User as UserIcon } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { actorLabel } from "@/components/layout/role-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { displayableAvatar } from "@/features/users/avatar";
import { AvatarUpload } from "@/features/users/components/avatar-upload";
import { ChangePasswordForm } from "@/features/users/components/change-password-form";
import { getOwnProfile } from "@/features/users/profile";

export const metadata: Metadata = { title: "Profilim | EventFlow" };

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-900/40 px-4 py-3">
      <span className="text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="truncate text-sm text-white">{value}</p>
      </div>
    </div>
  );
}

/** Her giriş yapmış kullanıcının kendi hesabı: bilgiler salt okunur; fotoğraf ve parola değiştirilebilir. */
export default async function ProfilePage() {
  const actor = await requirePolicyActor();
  const me = await getOwnProfile(db, actor);
  if (!me) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Profilim"
        description="Hesap bilgileriniz, profil fotoğrafınız ve parola ayarları"
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <UserIcon className="h-5 w-5" aria-hidden="true" />
          </div>
        }
      />
      <div className="space-y-6">
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle>{me.name}</CardTitle>
            <p className="text-sm text-slate-400">
              @{me.username} · {actorLabel(actor)}
              {me.position ? ` · ${me.position}` : ""}
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <AvatarUpload image={displayableAvatar(me.image)} name={me.name} />
            </div>
            <Row icon={<Mail className="h-4 w-4" aria-hidden="true" />} label="E-posta" value={me.email} />
            <Row icon={<Phone className="h-4 w-4" aria-hidden="true" />} label="Telefon" value={me.phone ?? "Belirtilmemiş"} />
          </CardContent>
        </Card>
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" aria-hidden="true" />
              Parola değiştir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
