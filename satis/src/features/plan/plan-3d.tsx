"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useId, useMemo, useState, type ReactNode } from "react";
import type { PlanModel } from "./model";
import type { TablePick } from "./picks";
import { Button } from "@/components/ui/button";
import type { CameraCommand, SeatView } from "./three/scene";
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
  const helpId = useId();

  const handleReady = useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Kamera" className="flex flex-wrap gap-1.5">
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
      <div
        data-testid="plan-3d-scene"
        data-ready={ready ? "true" : "false"}
        data-camera={cameraTag}
        className="relative h-[clamp(360px,58vw,600px)] w-full overflow-hidden rounded-xl border border-line bg-bg"
      >
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
