import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { UsersView } from "@/features/users/components/users-view";
import { listLinkableStaff, listUsers } from "@/features/users/queries";
import { isAdmin } from "@/features/auth/scope";

export const metadata: Metadata = { title: "Kullanıcılar | EventFlow" };

export default async function UsersPage() {
  const actor = await requirePolicyActor();
  if (!can(actor, "users", "view")) notFound();
  const [users, staffOptions] = await Promise.all([listUsers(db, actor), listLinkableStaff(db, actor)]);

  return (
    <UsersView
      users={users}
      selfId={actor.id}
      canCreate={can(actor, "users", "create")}
      canEdit={can(actor, "users", "edit")}
      staffOptions={staffOptions}
      canDelete={isAdmin(actor) && can(actor, "users", "delete")}
    />
  );
}
