"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { detect3dReason, detectCanOffer3d, type ThreeDUnavailableReason } from "./device";

export type PlanMode = "3d" | "2d";

const subscribeNothing = () => () => {};

export function usePlanView(): {
  can3d: boolean;
  detecting: boolean;
  reason: ThreeDUnavailableReason | null;
  failed: boolean;
  mode: PlanMode;
  show3d: boolean;
  setMode(m: PlanMode): void;
  fail(): void;
} {
  const can3dState = useSyncExternalStore<boolean | null>(subscribeNothing, detectCanOffer3d, () => null);
  const can3d = can3dState === true;
  const detecting = can3dState === null;
  const reason = useSyncExternalStore(subscribeNothing, detect3dReason, () => null);
  const [mode, setMode] = useState<PlanMode>("3d");
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => {
    setFailed(true);
    setMode("2d");
  }, []);
  const show3d = can3d && !failed && mode === "3d";

  return { can3d, detecting, reason, failed, mode, show3d, setMode, fail };
}
