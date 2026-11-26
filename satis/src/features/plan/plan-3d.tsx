"use client";

import dynamic from "next/dynamic";
import { Component, useMemo, type ReactNode } from "react";
import type { PlanModel } from "./model";
import { planToSceneDecor, planToSceneLines, planToSceneTables } from "./three/scene-data";

// three.js yalnızca 3B açılınca indirilir; sunucuda çizilmez.
const Scene3D = dynamic(() => import("./three/scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted" aria-busy="true">
      3B plan yükleniyor…
    </div>
  ),
});

type BoundaryProps = { onFail: () => void; children: ReactNode };

/** Sahne çizilirken oluşan hata (WebGL yok, bağlam açılamadı…) 2B'ye düşmek için üst bileşene bildirilir. */
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

export type Plan3DProps = {
  model: PlanModel;
  selectedId: string | null;
  onSelect?: (tableId: string) => void;
  /** Sahne açılamadı ya da WebGL bağlamı kayboldu: üst bileşen 2B'ye döner. */
  onFail: () => void;
  height?: number;
};

/** Planın 3B balo salonu görünümü (tembel yüklenir, hata sınırıyla sarılıdır). */
export function Plan3D({ model, selectedId, onSelect, onFail, height = 420 }: Plan3DProps) {
  const tables = useMemo(() => planToSceneTables(model, { selectedId }), [model, selectedId]);
  const decor = useMemo(() => planToSceneDecor(model), [model]);
  const lines = useMemo(() => planToSceneLines(model), [model]);
  return (
    <div className="flex flex-col gap-2">
      <div className="w-full overflow-hidden rounded-xl border border-line bg-bg" style={{ height }}>
        <SceneBoundary onFail={onFail}>
          <Scene3D tables={tables} decor={decor} lines={lines} canvas={model.canvas} onSelect={onSelect} onContextLost={onFail} />
        </SceneBoundary>
      </div>
      <p className="text-sm text-muted">Seçim için 2B plan ya da liste görünümünü kullanın.</p>
    </div>
  );
}
