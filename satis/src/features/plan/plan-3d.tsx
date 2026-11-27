"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useId, useMemo, useState, type ReactNode } from "react";
import type { PlanModel } from "./model";
import type { TablePick } from "./picks";
import { Button } from "@/components/ui/button";
import type { CameraCommand, HoverInfo, SeatView } from "./three/scene";
import { buildScene } from "./three/scene-data";

const Scene3D = dynamic(() => import("./three/scene"), {
  ssr: false,
});

type BoundaryProps = { onFail: () => void; children: ReactNode };

class SceneBoundary extends Component<BoundaryProps, { failed: boolean }> {
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

const CAMERA_BUTTONS: { type: CameraCommand["type"]; label: string; text: string }[] = [
  { type: "left", label: "Sola döndür", text: "↶" },
  { type: "right", label: "Sağa döndür", text: "↷" },
  { type: "in", label: "Yakınlaştır", text: "+" },
  { type: "out", label: "Uzaklaştır", text: "−" },
  { type: "top", label: "Üstten", text: "Üstten" },
  { type: "overview", label: "Genel", text: "Genel" },
];

export const DEFAULT_3D_HINT =
  "Döndürmek için sürükleyin, yakınlaşmak için tekerleği ya da iki parmağınızı kullanın. Masaya dokununca yakınlaşır; sandalye seçimi sağdaki numaralı düğmelerle de yapılabilir.";

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
        data-testid="plan-3d-scene"
        data-ready={ready ? "true" : "false"}
        data-camera={cameraTag}
        className="relative h-[clamp(440px,68dvh,680px)] w-full overflow-hidden rounded-[20px] border border-line-gold bg-bg"
      >
        <div
          role="group"
          aria-label="Kamera"
          className="absolute top-3 left-3 z-10 flex flex-wrap gap-1 rounded-full border border-line-gold bg-surface/75 px-2 py-1 backdrop-blur-md"
        >
          {CAMERA_BUTTONS.map((b) => (
            <Button
              key={b.type}
              variant="glass"
              aria-label={b.text === b.label ? undefined : b.label}
              className="px-3 py-1 text-sm"
              onClick={() => setCommand((c) => ({ type: b.type, nonce: (c?.nonce ?? 0) + 1 }))}
            >
              {b.text}
            </Button>
          ))}
        </div>
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
        {!ready && fallback ? <div className="absolute inset-0 z-10 overflow-auto">{fallback}</div> : null}
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
      </div>
      <p id={helpId} className="text-sm text-muted">
        {hint}
      </p>
    </div>
  );
}
