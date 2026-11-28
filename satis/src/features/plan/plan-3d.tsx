"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useId, useMemo, useState, type ReactNode } from "react";
import type { PlanModel } from "./model";
import type { TablePick } from "./picks";
import type { CameraCommand, HoverInfo, SeatView } from "./three/scene";
import { BALLROOM } from "./three/palette";
import { buildScene } from "./three/scene-data";

const Scene3D = dynamic(() => import("./three/scene"), {
  ssr: false,
});

type BoundaryProps = { onFail: () => void; children: ReactNode };

export class SceneBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export type { SeatView };

export type Plan3DProps = {
  model: PlanModel;
  picks: readonly TablePick[];
  activeTableId: string | null;
  dimmedIds?: ReadonlySet<string>;
  /** Sahne ekranı görseli (kendi kökenimizden) ve görsel yokken yazılacak ad. */
  artworkUrl?: string | null;
  title?: string;
  onTable?(tableId: string): void;
  onSeat?(tableId: string, seatNo: number): void;
  /** Sahne açılamadı ya da WebGL bağlamı kayboldu. */
  onFail(): void;
  onReady?(): void;
  /** nonce değişince kamera o masadan sahneye bakar. */
  seatView?: SeatView | null;
  /** Sahne hazır olana kadar gösterilecek içerik (2B plan). */
  fallback?: ReactNode;
  /** Tuvalin altındaki yönerge. */
  hint?: string;
};

const CAMERA_BUTTONS: { type: CameraCommand["type"]; label: string; symbol?: string }[] = [
  { type: "left", label: "Sola döndür", symbol: "↶" },
  { type: "right", label: "Sağa döndür", symbol: "↷" },
  { type: "in", label: "Yakınlaştır", symbol: "+" },
  { type: "out", label: "Uzaklaştır", symbol: "−" },
  { type: "overview", label: "Genel" },
  { type: "stage", label: "Sahne Önü" },
  { type: "loca", label: "Loca Balkonu" },
  { type: "top", label: "Üstten" },
];

export const DEFAULT_3D_HINT =
  "Sol tık/sürükle: Döndür · Sağ tık: Sağa sola kaydır · Tekerlek: Yakınlaştır. Masaya tıklayınca sahne görünümü ve detaylar açılır.";

/** Planın 3B balo salonu görünümü (tembel yüklenir, hata sınırıyla sarılıdır). */
export function Plan3D({
  model,
  picks,
  activeTableId,
  dimmedIds,
  artworkUrl,
  title,
  onTable,
  onSeat,
  onFail,
  onReady,
  seatView,
  fallback,
  hint = DEFAULT_3D_HINT,
}: Plan3DProps) {
  const scene = useMemo(
    () => buildScene({ model, picks, activeTableId, dimmedIds }),
    [model, picks, activeTableId, dimmedIds],
  );
  const [ready, setReady] = useState(false);
  const [cameraTag, setCameraTag] = useState("overview");
  const [command, setCommand] = useState<CameraCommand | null>(null);
  const [hovered, setHovered] = useState<HoverInfo | null>(null);
  const helpId = useId();

  const handleReady = useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label="Kamera"
        className="flex flex-wrap items-center gap-1.5 [&_button]:min-h-10 [&_button]:min-w-10"
      >
        {CAMERA_BUTTONS.map((b) => {
          const pressed = cameraTag === b.type;
          return (
            <button
              key={b.type}
              type="button"
              aria-label={b.label}
              title={b.label}
              aria-pressed={b.symbol ? undefined : pressed}
              onClick={() => setCommand((c) => ({ type: b.type, nonce: (c?.nonce ?? 0) + 1 }))}
              className={
                pressed
                  ? "cursor-pointer rounded-[10px] border border-gold bg-surface/90 px-3 py-1.5 text-xs font-semibold text-gold-bright backdrop-blur-md transition-colors"
                  : "cursor-pointer rounded-[10px] border border-line bg-surface/85 px-3 py-1.5 text-xs font-semibold text-ivory backdrop-blur-md transition-colors hover:border-gold hover:text-gold-bright"
              }
            >
              {b.symbol ?? b.label}
            </button>
          );
        })}
      </div>
      <div
        data-testid="plan-3d-scene"
        data-ready={ready ? "true" : "false"}
        data-camera={cameraTag}
        className="relative h-[calc(100dvh-13rem)] min-h-[420px] w-full overflow-hidden rounded-[16px] border border-line-gold bg-bg sm:h-[calc(100dvh-10.5rem)] sm:min-h-[540px]"
      >
        {hovered ? (
          <div
            role="status"
            className="pointer-events-none absolute z-20 rounded-xl border border-line-gold bg-surface/90 px-3 py-2 text-xs text-ivory shadow-lg backdrop-blur-md"
            style={{ left: Math.max(12, hovered.x + 14), top: Math.max(12, hovered.y - 12) }}
          >
            <div className="font-semibold text-gold-bright">{hovered.table.label}</div>
            {hovered.table.categoryLabel ? <div className="text-muted">{hovered.table.categoryLabel}</div> : null}
            {hovered.table.seats !== null && hovered.table.free !== null ? (
              <div className="mt-0.5 text-ivory">
                {hovered.table.free} / {hovered.table.seats} boş koltuk
              </div>
            ) : (
              <div className="mt-0.5 text-muted">Satışa kapalı</div>
            )}
          </div>
        ) : null}
        {!ready ? (
          fallback ? (
            <div className="absolute inset-0 z-10 overflow-auto">{fallback}</div>
          ) : (
            <div
              role="status"
              className="absolute inset-0 z-10 flex items-center justify-center bg-bg text-sm text-muted"
            >
              3B salon yükleniyor…
            </div>
          )
        ) : null}
        <SceneBoundary onFail={onFail}>
          <Scene3D
            scene={scene}
            canvas={model.canvas}
            activeTableId={activeTableId}
            artworkUrl={artworkUrl}
            title={title}
            seatView={seatView}
            onTable={onTable}
            onSeat={onSeat}
            onHoverTable={setHovered}
            onContextLost={onFail}
            onReady={handleReady}
            onCameraChange={setCameraTag}
            describedBy={helpId}
            command={command}
          />
        </SceneBoundary>
        <div className="pointer-events-none absolute right-2.5 bottom-2.5 left-2.5 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/85 px-3.5 py-2 text-xs text-muted backdrop-blur-md sm:right-3.5 sm:bottom-3 sm:left-3.5">
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: BALLROOM.tableOpen }} />
              Müsait
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: BALLROOM.tableStage }} />
              VIP / Premium
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: BALLROOM.tableFull }} />
              Müsait değil
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: BALLROOM.tablePick }} />
              Seçili
            </span>
          </div>
          <span className="hidden sm:inline">Sürükle: Döndür · Tekerlek: Yakınlaştır</span>
        </div>
      </div>
      <p id={helpId} className="text-sm text-muted">
        {hint}
      </p>
    </div>
  );
}
