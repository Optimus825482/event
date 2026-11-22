"use client";

import dynamic from "next/dynamic";
import type { PlanStatus } from "../plan-status";
import type { FloorPlanData } from "../plan-types";

export type FloorPlanViewProps = {
  /** Etkinlik yerleşimi (masalar, loca, dekor). Masa nesnelerindeki ek alanlar yok sayılır. */
  plan: FloorPlanData;
  /** Masa kimliği -> durum; verilmezse masa tipinin rengi kullanılır. */
  statuses?: Readonly<Record<string, PlanStatus>>;
  /** Seçili masa (sarı halka). */
  selectedId?: string | null;
  /** Tıklanamayan masalar (soluk). */
  disabledIds?: readonly string[];
  /** Seçilebilir bir masaya tıklanınca çağrılır; verilmezse plan yalnızca gösterir. */
  onSelect?: (tableId: string) => void;
  /**
   * Masa kimliği -> dolgu rengi (#RRGGBB). Verilen masalarda durum renginin önüne geçer; verilince
   * durum açıklaması ve ipucundaki durum etiketi gizlenir (renkler çağıranın açıklamasına aittir).
   */
  colorByTable?: Readonly<Record<string, string>>;
  /** Kalın beyaz kenarlıkla vurgulanan masalar (ör. seçili grubun masaları). */
  outlinedIds?: readonly string[];
  /**
   * Verilirse araç çubuğunda "Alan seç" düğmesi çıkar: açıkken boş alanda sürüklenen dikdörtgenin
   * içindeki seçilebilir masalar tek çağrıda bildirilir. Verilmezse kement seçimi yoktur.
   */
  onSelectMany?: (tableIds: string[]) => void;
  /** Araç çubuğu, yakınlaştırma ve kaydırma olmayan küçük önizleme. */
  compact?: boolean;
  /** Piksel; varsayılan 420 (compact: 220). */
  height?: number;
  ariaLabel?: string;
};

// Konva yalnızca tarayıcıda çalışır; düzenleyicideki gibi tembel ve ssr kapalı yüklenir.
const Scene = dynamic(() => import("./floor-plan-scene"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-56 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-400"
      aria-busy="true"
    >
      Plan yükleniyor…
    </div>
  ),
});

/** Salt okunur alan planı: sığdır, yakınlaştır/kaydır, masa seçimi, durum renkleri ve masa arama. */
export function FloorPlanView(props: FloorPlanViewProps) {
  if (props.plan.tables.length === 0 && props.plan.decor.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-600 bg-slate-900 p-6 text-center text-sm text-slate-400">
        Bu etkinlik için henüz yerleşim planı yok.
      </p>
    );
  }
  return <Scene {...props} />;
}
