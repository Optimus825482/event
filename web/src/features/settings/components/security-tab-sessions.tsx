"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormStatus } from "@/features/users/components/field";
import { revokeOtherSessionsAction, revokeSessionAction } from "../security-actions";
import type { SecuritySession } from "../security-queries";
import { formatDateTime } from "./format-date";
import { useSettingsSave } from "./use-settings-save";

export function SecuritySessions({ sessions }: { sessions: SecuritySession[] }) {
  const single = useSettingsSave("Oturum kapatıldı");
  const bulk = useSettingsSave("Diğer oturumlar kapatıldı");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pending = single.pending || bulk.pending;
  const hasOthers = sessions.some((s) => !s.isCurrent);

  return (
    <Card className="border-slate-700 bg-slate-800/50">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Etkin oturumlar</CardTitle>
          <CardDescription>{sessions.length} etkin oturum</CardDescription>
        </div>
        <Button
          variant="outline"
          className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          disabled={pending || !hasOthers}
          onClick={() => setConfirmOpen(true)}
        >
          Tüm diğer oturumları kapat
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {single.state && !single.state.ok ? <FormStatus state={single.state} /> : null}
        {bulk.state && !bulk.state.ok ? <FormStatus state={bulk.state} /> : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kullanıcı</TableHead>
              <TableHead>Başlangıç</TableHead>
              <TableHead>Bitiş</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Tarayıcı</TableHead>
              <TableHead className="text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <span className="font-medium text-white">{s.userName}</span>
                  <span className="ml-2 text-xs text-slate-400">@{s.username}</span>
                  {s.isCurrent ? <span className="ml-2 text-xs text-amber-400">(bu oturum)</span> : null}
                </TableCell>
                <TableCell>{formatDateTime(s.createdAt)}</TableCell>
                <TableCell>{formatDateTime(s.expiresAt)}</TableCell>
                <TableCell>{s.ipAddress ?? "—"}</TableCell>
                <TableCell className="max-w-56 truncate" title={s.userAgent ?? undefined}>
                  {s.userAgent ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {s.isCurrent ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      aria-label={`${s.username} oturumunu kapat`}
                      onClick={() => single.save(() => revokeSessionAction({ sessionId: s.id }))}
                    >
                      Oturumu kapat
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Diğer oturumlar kapatılsın mı?"
        description="Bu oturum dışındaki tüm kullanıcıların oturumları kapanır; yeniden giriş yapmaları gerekir."
        confirmText="Hepsini kapat"
        variant="destructive"
        loading={bulk.pending}
        onConfirm={() => {
          setConfirmOpen(false);
          bulk.save(() => revokeOtherSessionsAction({}));
        }}
      />
    </Card>
  );
}
