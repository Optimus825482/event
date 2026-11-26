"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteFinanceItemAction } from "../actions";
import { FINANCE_CATEGORY_LABELS, FINANCE_DIRECTION_LABELS } from "../constants";
import { formatMoney } from "../money";
import type { FinanceOverview } from "../overview";
import { ItemDialog, type FinanceItem } from "./item-dialog";
import { useFinanceAction } from "./use-finance-action";

type DialogState = { kind: "create" } | { kind: "edit"; item: FinanceItem } | null;

/** Gider ve gelir kalemleri tablosu; ekleme / düzenleme / silme. */
export function ItemsSection({ overview }: { overview: FinanceOverview }) {
  const { items, permissions, currency, event } = overview;
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toDelete, setToDelete] = useState<FinanceItem | null>(null);
  const { busy, error, run } = useFinanceAction();

  async function confirmDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    await run(() => deleteFinanceItemAction({ id }), "Kalem silindi");
    setToDelete(null);
  }

  const showActions = permissions.edit || permissions.delete;

  return (
    <section
      role="region"
      aria-labelledby="finance-items-heading"
      className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="finance-items-heading" className="text-lg font-semibold">
          Gider ve gelir kalemleri
        </h2>
        {permissions.create ? (
          <Button type="button" className="h-11" onClick={() => setDialog({ kind: "create" })}>
            <Plus aria-hidden />
            Kalem ekle
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz kalem yok.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Yön</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Kalem</TableHead>
              <TableHead className="text-right">Tahmini</TableHead>
              <TableHead className="text-right">Gerçekleşen</TableHead>
              <TableHead>Not</TableHead>
              {showActions ? (
                <TableHead>
                  <span className="sr-only">İşlemler</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{FINANCE_DIRECTION_LABELS[item.direction]}</TableCell>
                <TableCell>{FINANCE_CATEGORY_LABELS[item.category]}</TableCell>
                <TableCell className="whitespace-normal font-medium">{item.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(item.estimatedAmount)} {currency}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.actualAmount === null ? (
                    <>
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">Girilmedi</span>
                    </>
                  ) : (
                    `${formatMoney(item.actualAmount)} ${currency}`
                  )}
                </TableCell>
                <TableCell className="min-w-40 max-w-64 whitespace-normal text-muted-foreground">
                  {item.note ?? ""}
                </TableCell>
                {showActions ? (
                  <TableCell>
                    <div className="flex gap-2">
                      {permissions.edit ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => setDialog({ kind: "edit", item })}
                          aria-label={`${item.label} kalemini düzenle`}
                        >
                          Düzenle
                        </Button>
                      ) : null}
                      {permissions.delete ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 border-destructive text-destructive"
                          onClick={() => setToDelete(item)}
                          disabled={busy}
                          aria-label={`${item.label} kalemini sil`}
                        >
                          Sil
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {dialog ? (
        <ItemDialog
          key={dialog.kind === "edit" ? dialog.item.id : "create"}
          eventId={event.id}
          currency={currency}
          item={dialog.kind === "edit" ? dialog.item : null}
          onClose={() => setDialog(null)}
        />
      ) : null}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title="Kalemi sil"
        description={toDelete ? `"${toDelete.label}" kalemi silinsin mi?` : ""}
        confirmText="Sil"
        variant="destructive"
        loading={busy}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
