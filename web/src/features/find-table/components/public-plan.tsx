"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FloorPlan3D } from "@/features/venue/components/floor-plan-3d";
import { FloorPlanView } from "@/features/venue/components/floor-plan-view";
import type { FloorPlanData } from "@/features/venue/plan-types";
import { HIGHLIGHT_COLOR } from "../highlight";
import { canOffer3d, readDeviceHints } from "../device";

const FALLBACK_NOTE = "3B görünüm bu cihazda açılamadı; 2B plan gösteriliyor.";

class Plan3DBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Props = { plan: FloorPlanData; highlightIds: string[]; ariaLabel: string };

/** 2B ile açılır; 3B yalnızca cihaz uygunsa ve kullanıcı isterse çizilir, hata olursa 2B'ye dönülür. */
export function PublicPlan({ plan, highlightIds, ariaLabel }: Props) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [failed, setFailed] = useState(false);
  // Sunucu çıktısıyla uyumsuzluk olmasın diye ipuçları ilk çizimden sonra okunur.
  const [offer3d, setOffer3d] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı ipuçları yalnızca istemcide okunabilir
    setOffer3d(canOffer3d(readDeviceHints()));
  }, []);

  const shared = useMemo(() => {
    const own = new Set(highlightIds);
    return {
      selectedId: highlightIds[0] ?? null,
      outlinedIds: highlightIds,
      colorByTable: Object.fromEntries(highlightIds.map((id) => [id, HIGHLIGHT_COLOR])),
      disabledIds: plan.tables.filter((t) => !own.has(t.id)).map((t) => t.id),
    };
  }, [plan, highlightIds]);

  const show3d = mode === "3d" && !failed;
  const props = { plan, ariaLabel, height: 360, ...shared };

  return (
    <div className="flex flex-col gap-3">
      {offer3d && !failed ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 self-start border-slate-400 text-foreground"
          onClick={() => setMode(show3d ? "2d" : "3d")}
        >
          {show3d ? "2B'ye dön" : "3B göster"}
        </Button>
      ) : null}
      {failed ? (
        <p role="status" className="text-sm text-muted-foreground">
          {FALLBACK_NOTE}
        </p>
      ) : null}
      {show3d ? (
        <Plan3DBoundary onError={() => setFailed(true)}>
          <FloorPlan3D {...props} />
        </Plan3DBoundary>
      ) : (
        <FloorPlanView {...props} />
      )}
    </div>
  );
}
