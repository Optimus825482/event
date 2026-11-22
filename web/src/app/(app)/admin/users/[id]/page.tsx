import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ROLE_LABELS } from "@/components/layout/role-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { isDeletedAccount } from "@/features/users/filter";
import { AccountPanel } from "@/features/users/components/account-panel";
import { EditUserForm } from "@/features/users/components/edit-user-form";
import { PermissionsForm } from "@/features/users/components/permissions-form";
import { UserDeleteButton } from "@/features/users/components/user-delete-button";
import { getUserDetail } from "@/features/users/queries";

export const metadata: Metadata = { title: "Kullanıcı | EventFlow" };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const actor = await requirePolicyActor();
  if (!can(actor, "users", "view")) notFound();
  const user = await getUserDetail(db, actor, id);
  if (!user) notFound();
  const canEdit = can(actor, "users", "edit");
  // Liste ile aynı kural: yalnızca yönetici ve izin, kendi hesabı ve silinmiş hesap değil.
  const canDelete = actor.role === "admin" && can(actor, "users", "delete") && user.id !== actor.id && !isDeletedAccount(user);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Kullanıcılar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{user.username}</h1>
        <p className="text-sm text-muted-foreground">
          {ROLE_LABELS[user.role]} · {user.isActive ? "Aktif" : "Pasif"}
        </p>
      </div>

      {canEdit ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Profil ve rol</CardTitle>
            </CardHeader>
            <CardContent>
              <EditUserForm user={user} />
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
          <Card>
            <CardHeader>
              <CardTitle>Modül izinleri</CardTitle>
            </CardHeader>
            <CardContent>
              <PermissionsForm userId={user.id} initial={user.permissions} />
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
