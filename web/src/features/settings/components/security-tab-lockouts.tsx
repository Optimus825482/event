"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormStatus } from "@/features/users/components/field";
import { clearLockoutAction } from "../security-actions";
import type { SecurityLockout } from "../security-queries";
import { formatDateTime } from "./format-date";
import { useSettingsSave } from "./use-settings-save";

export function SecurityLockouts({ lockouts, windowMinutes }: { lockouts: SecurityLockout[]; windowMinutes: number }) {
  const { pending, state, save } = useSettingsSave("Kilit kaldırıldı");

  return (
    <Card className="border-slate-700 bg-slate-800/50">
      <CardHeader>
        <CardTitle>Giriş kilitleri</CardTitle>
        <CardDescription>Deneme sınırını aşmış hesaplar; kilit {windowMinutes} dakika sonra kendiliğinden açılır</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state && !state.ok ? <FormStatus state={state} /> : null}
        {lockouts.length === 0 ? (
          <p className="text-sm text-slate-400">Şu anda kilitli hesap yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı adı</TableHead>
                <TableHead>Kapsam</TableHead>
                <TableHead>Deneme</TableHead>
                <TableHead>Kilit bitişi</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lockouts.map((l) => (
                <TableRow key={`${l.username}|${l.ip}`}>
                  <TableCell className="font-medium text-white">{l.username}</TableCell>
                  <TableCell>{l.scope === "all" ? "Tüm IP'ler" : l.ip}</TableCell>
                  <TableCell>{l.attempts}</TableCell>
                  <TableCell>{formatDateTime(l.expiresAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      aria-label={`${l.username} kilidini kaldır`}
                      onClick={() => save(() => clearLockoutAction({ username: l.username, ip: l.ip }))}
                    >
                      Kilidi kaldır
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
