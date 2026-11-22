"use client";

import type Konva from "konva";
import { useCallback, useEffect, useState } from "react";
import type { Point } from "../editor/geometry";
import { resolveEndpoint } from "../editor/lines";
import type { EditorStore } from "../editor/store";

type StageEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent>;
export type LinePreview = { start: Point; end: Point } | null;

function shiftHeld(e: StageEvent): boolean {
  return "shiftKey" in e.evt && e.evt.shiftKey;
}

/**
 * Çizgi aracı: ilk tıklama başlangıcı, ikinci tıklama bitişi belirler (ızgara açıksa uçlar ızgaraya oturur,
 * Shift yatay/dikey kilitler). Esc bekleyen çizgiyi iptal eder; bekleyen yoksa seçim aracına döner.
 */
export function useLineDrawing(store: EditorStore) {
  const [start, setStart] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);

  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.tool !== prev.tool) {
          setStart(null);
          setCursor(null);
        }
      }),
    [store],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || store.getState().tool !== "line") return;
      if (start) {
        setStart(null);
        setCursor(null);
      } else store.getState().setTool("select");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, start]);

  const resolve = useCallback(
    (raw: Point, anchor: Point | null, constrain: boolean) => {
      const s = store.getState();
      return resolveEndpoint(raw, anchor, { gridSize: s.gridSize, snap: s.snapEnabled, canvas: s.canvas, constrain });
    },
    [store],
  );

  /** Çizgi aracı etkinse tıklamayı işler ve `true` döner (seçim çerçevesi başlamaz). */
  const onStageDown = useCallback(
    (e: StageEvent): boolean => {
      if (store.getState().tool !== "line") return false;
      if ("button" in e.evt && e.evt.button !== 0) return true;
      const raw = e.target.getStage()?.getRelativePointerPosition();
      if (!raw) return true;
      if (!start) {
        const p = resolve(raw, null, false);
        setStart(p);
        setCursor(p);
        return true;
      }
      const end = resolve(raw, start, shiftHeld(e));
      // Çok kısa çizgi (aynı noktaya ikinci tıklama) eklenmez; başlangıç bekler.
      if (store.getState().addLine(start, end) !== null) {
        setStart(null);
        setCursor(null);
      }
      return true;
    },
    [store, start, resolve],
  );

  const onStageMove = useCallback(
    (e: StageEvent) => {
      if (!start || store.getState().tool !== "line") return;
      const raw = e.target.getStage()?.getRelativePointerPosition();
      if (raw) setCursor(resolve(raw, start, shiftHeld(e)));
    },
    [store, start, resolve],
  );

  const preview: LinePreview = start && cursor ? { start, end: cursor } : null;
  return { onStageDown, onStageMove, preview };
}
