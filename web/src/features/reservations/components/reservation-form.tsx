"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FloorPlanView } from "@/features/venue/components/floor-plan-view";
import { isTableSelectable, type PlanStatus } from "@/features/venue/plan-status";
import type { FloorPlanData } from "@/features/venue/plan-types";
import { useRunAction } from "@/features/customers/components/use-run-action";
import { Field, SELECT_CLASS } from "@/features/users/components/field";
import { createReservationAction } from "../actions";
import type { AvailableTable } from "../read-service";
import { PlanLegend, WizardCard, WizardSteps } from "./wizard-steps";

export type CustomerOption = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isBlacklisted: boolean;
};

type Props = {
  eventId: string;
  tables: AvailableTable[];
  customers: CustomerOption[];
  canOverrideBlacklist: boolean;
  /** Verilirse "plandan masa seç" bölümü gösterilir; açılır liste yine de klavye alternatifidir. */
  plan?: FloorPlanData;
  tableStatuses?: Readonly<Record<string, PlanStatus>>;
};

export function ReservationForm({ eventId, tables, customers, canOverrideBlacklist, plan, tableStatuses }: Props) {
  const router = useRouter();
  const { pending, failure, run } = useRunAction();
  const [selected, setSelected] = useState<CustomerOption | null>(null);
  const [tableId, setTableId] = useState("");
  const [showPlan, setShowPlan] = useState(false);
  const [guests, setGuests] = useState(2);
  const [typedName, setTypedName] = useState("");
  const free = tables.filter((t) => t.available);
  const capacity = free.find((t) => t.id === tableId)?.capacity;
  const errors = failure?.fieldErrors ?? {};
  // Müsaitlik kuralı rezervasyon servisinden gelir (`available`); plan yalnızca aynı sonucu gösterir.
  const blockedIds = tables.filter((t) => !isTableSelectable(t, guests)).map((t) => t.id);
  const pickedLabel = tables.find((t) => t.id === tableId)?.label;
  const guestDone = selected !== null || typedName.trim().length >= 2;
  const steps = [
    { key: "guest", label: "Misafir", done: guestDone },
    { key: "table", label: "Masa", done: tableId !== "" },
    { key: "confirm", label: "Onay", done: false },
  ];

  function submit(form: FormData) {
    const value = (key: string) => {
      const v = form.get(key);
      return typeof v === "string" ? v : undefined;
    };
    run(
      createReservationAction,
      {
        eventId,
        tableId: value("tableId"),
        guestCount: value("guestCount"),
        customerId: selected?.id,
        guestName: value("guestName"),
        guestPhone: value("guestPhone"),
        guestEmail: value("guestEmail"),
        specialRequests: value("specialRequests"),
        overrideBlacklist: value("overrideBlacklist") === "on",
      },
      (data) => router.push(`/reservations/${eventId}/${data.id}`),
      "Rezervasyon oluşturuldu",
    );
  }

  if (free.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Bu etkinlikte boş masa yok.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
      className="space-y-5"
    >
      <WizardSteps steps={steps} />

      <WizardCard index={1} title="Misafir bilgileri">
        {customers.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Bulunan müşteriler</legend>
            <ul className="divide-y divide-border rounded-md border border-border">
              {customers.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    {c.fullName}
                    <span className="ml-2 text-muted-foreground">{c.phone ?? c.email ?? ""}</span>
                    {c.isBlacklisted ? <span className="ml-2 text-destructive">Kara listede</span> : null}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={selected?.id === c.id ? "default" : "outline"}
                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    aria-pressed={selected?.id === c.id}
                  >
                    {selected?.id === c.id ? "Seçildi" : "Seç"}
                  </Button>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}

        {selected ? (
          <p className="rounded-md bg-muted p-3 text-sm">
            Müşteri: <strong>{selected.fullName}</strong>. Aşağıdaki misafir alanları boş bırakılırsa müşteri bilgisi kullanılır.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="guestName" label="Misafir adı" errors={errors.guestName}>
            <Input id="guestName" name="guestName" autoComplete="off" onChange={(e) => setTypedName(e.target.value)} />
          </Field>
          <Field id="guestPhone" label="Telefon" errors={errors.guestPhone}>
            <Input id="guestPhone" name="guestPhone" type="tel" autoComplete="off" />
          </Field>
          <Field id="guestEmail" label="E-posta" errors={errors.guestEmail}>
            <Input id="guestEmail" name="guestEmail" type="email" autoComplete="off" />
          </Field>
        </div>

        <Field id="specialRequests" label="Özel istek" errors={errors.specialRequests}>
          <Textarea id="specialRequests" name="specialRequests" rows={3} />
        </Field>
      </WizardCard>

      <WizardCard index={2} title="Masa seçimi">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="tableId" label="Masa" errors={errors.tableId}>
            <select
              id="tableId"
              name="tableId"
              required
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Masa seçin</option>
              {free.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.capacity} kişilik{t.isLoca ? ", loca" : ""})
                </option>
              ))}
            </select>
          </Field>
          <Field id="guestCount" label="Kişi sayısı" errors={errors.guestCount} hint={capacity ? `En fazla ${capacity}` : undefined}>
            <Input
              id="guestCount"
              name="guestCount"
              type="number"
              min={1}
              max={capacity ?? 50}
              defaultValue={2}
              required
              onChange={(e) => setGuests(e.target.valueAsNumber)}
            />
          </Field>
        </div>

        {plan ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={showPlan}
                aria-controls="reservation-plan"
                onClick={() => setShowPlan((v) => !v)}
              >
                {showPlan ? "Planı gizle" : "Plandan masa seç"}
              </Button>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {pickedLabel ? `Seçilen masa: ${pickedLabel}` : "Masayı yukarıdaki listeden de seçebilirsiniz."}
              </p>
            </div>
            {showPlan ? (
              <div id="reservation-plan" className="space-y-2">
                <PlanLegend />
                <FloorPlanView
                  plan={plan}
                  statuses={tableStatuses}
                  selectedId={tableId || null}
                  disabledIds={blockedIds}
                  onSelect={setTableId}
                  ariaLabel="Masa seçimi için yerleşim planı"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </WizardCard>

      <WizardCard index={3} title="Onay">
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Misafir</dt>
          <dd>{selected?.fullName ?? (typedName.trim() || "Henüz girilmedi")}</dd>
          <dt className="text-muted-foreground">Masa</dt>
          <dd>{pickedLabel ?? "Henüz seçilmedi"}</dd>
          <dt className="text-muted-foreground">Kişi</dt>
          <dd>{Number.isFinite(guests) ? guests : "-"}</dd>
        </dl>

        {canOverrideBlacklist ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="overrideBlacklist" />
            Müşteri kara listedeyse yine de rezervasyon yap (yönetici onayı)
          </label>
        ) : null}

        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure.message}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={pending}
          className="bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-500 hover:to-violet-500"
        >
          {pending ? "Kaydediliyor..." : "Rezervasyonu oluştur"}
        </Button>
      </WizardCard>
    </form>
  );
}
