"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Shield, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ROLE_LABELS } from "@/components/layout/role-labels";
import { StatCard } from "@/components/layout/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ROLES } from "@/features/auth/roles";
import { deleteUserAction, setUserActiveAction } from "../actions";
import { countUsers, filterUsers, isDeletedAccount, type RoleFilter, type StatusFilter } from "../filter";
import type { UserSummary } from "../types";
import { CreateUserForm } from "./create-user-form";
import { EditUserForm } from "./edit-user-form";
import { SELECT_CLASS } from "./field";
import { ResetPasswordForm } from "./reset-password-form";

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; user: UserSummary }
  | { kind: "password"; user: UserSummary }
  | { kind: "toggle"; user: UserSummary }
  | { kind: "delete"; user: UserSummary }
  | null;

type Props = { users: UserSummary[]; selfId: string; canCreate: boolean; canEdit: boolean; canDelete: boolean };

export function UsersView({ users, selfId, canCreate, canEdit, canDelete }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [announcement, setAnnouncement] = useState("");

  const counts = useMemo(() => countUsers(users), [users]);
  const visible = useMemo(() => filterUsers(users, { search, role, status }), [users, search, role, status]);

  function done(message: string) {
    setAnnouncement(message);
    setDialog(null);
  }

  function setActive(user: UserSummary, active: boolean) {
    startTransition(async () => {
      const result = await setUserActiveAction({ id: user.id, active });
      setDialog(null);
      if (result.ok) {
        const message = active ? "Kullanıcı etkinleştirildi" : "Kullanıcı pasifleştirildi";
        toast.success(message);
        setAnnouncement(message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function remove(user: UserSummary) {
    startTransition(async () => {
      const result = await deleteUserAction({ id: user.id });
      setDialog(null);
      if (result.ok) {
        const message =
          result.data.mode === "deleted"
            ? "Kullanıcı silindi"
            : "Kullanıcı geçmiş kayıtlarda anıldığı için anonimleştirildi ve kapatıldı";
        toast.success(message);
        setAnnouncement(message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Kullanıcılar"
        description="Sistem kullanıcılarını, rollerini ve hesap durumlarını yönetin"
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
        }
        actions={
          canCreate ? (
            <Button onClick={() => setDialog({ kind: "create" })} className="bg-amber-600 text-white hover:bg-amber-700">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Yeni kullanıcı
            </Button>
          ) : null
        }
      />
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Toplam" value={counts.total} tone="amber" icon={<Users className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="Aktif" value={counts.active} tone="emerald" icon={<UserCheck className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="Pasif" value={counts.inactive} tone="red" icon={<UserX className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="Yönetici" value={counts.admins} tone="purple" icon={<Shield className="h-5 w-5" aria-hidden="true" />} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Kullanıcı adı, ad, e-posta, telefon veya görev ara…"
            aria-label="Kullanıcı ara"
            className="pl-9"
          />
        </div>
        <select
          aria-label="Rol süzgeci"
          value={role}
          onChange={(event) => setRole(event.target.value as RoleFilter)}
          className={`${SELECT_CLASS} sm:w-44`}
        >
          <option value="all">Tüm roller</option>
          {ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Durum süzgeci"
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          className={`${SELECT_CLASS} sm:w-40`}
        >
          <option value="all">Tüm durumlar</option>
          <option value="active">Aktif</option>
          <option value="inactive">Pasif</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={users.length === 0 ? "Henüz kullanıcı yok" : "Süzgece uyan kullanıcı yok"}
          description={users.length === 0 ? undefined : "Arama veya süzgeçleri değiştirin."}
          icon={<Users aria-hidden="true" />}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
          <Table>
            <TableHeader className="bg-slate-900/50">
              <TableRow>
                <TableHead>Kullanıcı adı</TableHead>
                <TableHead>Ad soyad</TableHead>
                <TableHead className="hidden md:table-cell">E-posta</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>
                  <span className="sr-only">İşlemler</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-white">{user.username}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={user.role === "admin" ? "border-amber-500/40 text-amber-400" : ""}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "secondary" : "outline"}>
                      {isDeletedAccount(user) ? "Silinmiş" : user.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      {canEdit && !isDeletedAccount(user) ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "edit", user })}>
                            Düzenle
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "password", user })}>
                            Parola
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending || (user.id === selfId && user.isActive)}
                            onClick={() => (user.isActive ? setDialog({ kind: "toggle", user }) : setActive(user, true))}
                          >
                            {user.isActive ? "Pasifleştir" : "Etkinleştir"}
                          </Button>
                        </>
                      ) : null}
                      {canDelete && user.id !== selfId && !isDeletedAccount(user) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          disabled={pending}
                          aria-label={`${user.username} kullanıcısını sil`}
                          onClick={() => setDialog({ kind: "delete", user })}
                        >
                          Sil
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/users/${user.id}`} aria-label={`${user.username} ayrıntıları ve izinleri`}>
                          Ayrıntı
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialog?.kind === "create"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Yeni kullanıcı</DialogTitle>
            <DialogDescription>Kullanıcı adı ve parola ile yeni bir hesap oluşturun.</DialogDescription>
          </DialogHeader>
          <CreateUserForm onDone={done} />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === "edit"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Kullanıcıyı düzenle</DialogTitle>
            <DialogDescription>{dialog?.kind === "edit" ? dialog.user.username : ""}</DialogDescription>
          </DialogHeader>
          {dialog?.kind === "edit" ? <EditUserForm key={dialog.user.id} user={dialog.user} onDone={done} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === "password"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parolayı sıfırla</DialogTitle>
            <DialogDescription>
              {dialog?.kind === "password" ? `${dialog.user.username} için yeni parola belirleyin; açık oturumları kapatılır.` : ""}
            </DialogDescription>
          </DialogHeader>
          {dialog?.kind === "password" ? <ResetPasswordForm key={dialog.user.id} userId={dialog.user.id} onDone={done} /> : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={dialog?.kind === "toggle"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Kullanıcı pasifleştirilsin mi?"
        description="Kullanıcı pasifleştirilecek ve tüm oturumları kapatılacak."
        confirmText="Pasifleştir"
        variant="destructive"
        loading={pending}
        onConfirm={() => dialog?.kind === "toggle" && setActive(dialog.user, false)}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Kullanıcı silinsin mi?"
        description={
          dialog?.kind === "delete"
            ? `${dialog.user.username} hesabı silinecek ve tüm oturumları kapatılacak. Etkinlik sahibi ya da değerlendiren olarak anılıyorsa kayıt bozulmasın diye hesap anonimleştirilip kalıcı olarak kapatılır. Bu işlem geri alınamaz.`
            : ""
        }
        confirmText="Sil"
        variant="destructive"
        loading={pending}
        onConfirm={() => dialog?.kind === "delete" && remove(dialog.user)}
      />
    </div>
  );
}
