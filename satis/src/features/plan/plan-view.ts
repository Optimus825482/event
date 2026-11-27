"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { detect3dReason, detectCanOffer3d, type ThreeDUnavailableReason } from "./device";

export type PlanMode = "3d" | "2d";

const subscribeNothing = () => () => {};

export function usePlanView(): {
  can3d: boolean;
  reason: ThreeDUnavailableReason | null;
  failed: boolean;
  mode: PlanMode;
  show3d: boolean;
  setMode(m: PlanMode): void;
  fail(): void;
} {
  const can3d = useSyncExternalStore(subscribeNothing, detectCanOffer3d, () => false);
  const reason = useSyncExternalStore(subscribeNothing, detect3dReason, () => null);
  const [mode, setMode] = useState<PlanMode>("3d");
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => {
    setFailed(true);
    setMode("2d");
  }, []);
  const show3d = can3d && !failed && mode === "3d";

  return { can3d, reason, failed, mode, show3d, setMode, fail };
}
