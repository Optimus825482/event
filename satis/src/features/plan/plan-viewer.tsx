"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { detectCanOffer3d } from "./device";
import type { PlanModel } from "./model";
import { Plan3D } from "./plan-3d";
import { PlanSvg } from "./plan-svg";

const subscribeNothing = () => () => {};

/** 2B plan (varsayılan) ve uygun cihazlarda 3B balo salonu görünümü; seçim üst bileşendedir, görünüm değişince korunur. */
export function PlanViewer({ model, selectedId = null, onSelect }: { model: PlanModel; selectedId?: string | null; onSelect?: (tableId: string) => void }) {
  // Sunucuda ve ilk istemci çiziminde false; cihaz yoklaması yalnızca istemcide yapılır.
  const can3d = useSyncExternalStore(subscribeNothing, detectCanOffer3d, () => false);
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => {
    setFailed(true);
    setMode("2d");
  }, []);
  const show3d = can3d && !failed && mode === "3d";

  return (
    <div className="flex flex-col gap-3">
      {failed ? <Notice>3B görünüm açılamadı; 2B plan gösteriliyor.</Notice> : null}
      {can3d && !failed ? (
        <div>
          <Button variant="glass" aria-pressed={show3d} onClick={() => setMode(show3d ? "2d" : "3d")}>
            {show3d ? "2B görünüm" : "3B görünüm"}
          </Button>
        </div>
      ) : null}
      {show3d ? (
        <Plan3D model={model} selectedId={selectedId} onSelect={onSelect} onFail={fail} />
      ) : (
        <PlanSvg model={model} selectedId={selectedId} onSelect={onSelect} />
      )}
    </div>
  );
}
