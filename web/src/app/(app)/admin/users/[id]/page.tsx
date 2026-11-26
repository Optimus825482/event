import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { isDeletedAccount } from "@/features/users/filter";
import { AccountPanel } from "@/features/users/components/account-panel";
import { EditUserForm } from "@/features/users/components/edit-user-form";
import { UserDeleteButton } from "@/features/users/components/user-delete-button";
import { accessSummary } from "@/features/users/form-model";
import { getUserDetail, listLinkableStaff } from "@/features/users/queries";
import { isAdmin } from "@/features/auth/scope";

export const metadata: Metadata = { title: "Kullanıcı | EventFlow" };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const actor = await requirePolicyActor();
  if (!can(actor, "users", "view")) notFound();
  const user = await getUserDetail(db, actor, id);
  if (!user) notFound();
  const canEdit = can(actor, "users", "edit");
  const staffOptions = canEdit ? await listLinkableStaff(db, actor) : [];
  const linkedStaff = staffOptions.find((p) => p.id === user.staffId);
  // Liste ile aynı kural: yalnızca yönetici ve izin, kendi hesabı ve silinmiş hesap değil.
  const canDelete = isAdmin(actor) && can(actor, "users", "delete") && user.id !== actor.id && !isDeletedAccount(user);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Kullanıcılar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{user.username}</h1>
        <p className="text-sm text-muted-foreground">
          {accessSummary(user.role, user.memberships)} · {user.isActive ? "Aktif" : "Pasif"}
          {linkedStaff ? ` · Personel: ${linkedStaff.fullName}` : ""}
        </p>
      </div>

      {canEdit ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Profil, rol ve izinler</CardTitle>
            </CardHeader>
            <CardContent>
              <EditUserForm user={user} staffOptions={staffOptions} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Hesap</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountPanel userId={user.id} isActive={user.isActive} isSelf={user.id === actor.id} />
            </CardContent>
          </Card>
        </>
      ) : null}
      {canDelete ? (
        <Card>
          <CardHeader>
            <CardTitle>Hesabı sil</CardTitle>
          </CardHeader>
          <CardContent>
            <UserDeleteButton user={user} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
