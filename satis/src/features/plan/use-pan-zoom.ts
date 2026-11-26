"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { fitView, isTap, panBy, pinchView, zoomAround, type Point, type Size, type View } from "./view-math";

const BUTTON_STEP = 1.25;
const WHEEL_STEP = 1.1;

type Gesture = {
  pointers: Map<number, Point>;
  down: Point | null;
  last: Point | null;
  pinch: { view: View; a: Point; b: Point } | null;
  moved: boolean;
};

/** Pointer Events ile kaydırma ve iki parmakla yakınlaştırma; kullanıcı dokunmadıkça görünüm kapsayıcıya sığar. */
export function usePanZoom(canvas: Size): {
  ref: RefObject<HTMLDivElement | null>;
  view: View;
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [userView, setUserView] = useState<View | null>(null);

  const { width: canvasWidth, height: canvasHeight } = canvas;
  const fitted = useMemo<View>(
    () =>
      size.width > 0 && size.height > 0
        ? fitView({ width: canvasWidth, height: canvasHeight }, size)
        : { scale: 1, x: 0, y: 0 },
    [canvasWidth, canvasHeight, size],
  );
  const view = userView ?? fitted;

  // Olay işleyicileri güncel görünümü bu ref'ten okur.
  const viewRef = useRef<View>(view);
  const fittedRef = useRef<View>(fitted);
  useEffect(() => {
    viewRef.current = view;
    fittedRef.current = fitted;
  }, [view, fitted]);

  const gesture = useRef<Gesture>({ pointers: new Map(), down: null, last: null, pinch: null, moved: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize((prev) => (prev.width === rect.width && prev.height === rect.height ? prev : { width: rect.width, height: rect.height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const g = gesture.current;
    const local = (event: PointerEvent): Point => {
      const rect = el.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const pair = (): [Point, Point] | null => {
      const [a, b] = [...g.pointers.values()];
      return a && b ? [a, b] : null;
    };

    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("button")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const point = local(event);
      g.pointers.set(event.pointerId, point);
      if (g.pointers.size === 1) {
        g.down = point;
        g.last = point;
        g.moved = false;
      } else if (g.pointers.size === 2) {
        const both = pair();
        if (both) g.pinch = { view: viewRef.current, a: both[0], b: both[1] };
        g.moved = true;
      }
    };

    const onMove = (event: PointerEvent) => {
      if (!g.pointers.has(event.pointerId)) return;
      const point = local(event);
      g.pointers.set(event.pointerId, point);
      if (g.pointers.size >= 2) {
        const both = pair();
        const start = g.pinch;
        if (both && start) setUserView(pinchView(start, { a: both[0], b: both[1] }));
        return;
      }
      if (!g.down || !g.last) return;
      if (!g.moved && !isTap(g.down, point)) g.moved = true;
      if (g.moved) {
        const { x: lx, y: ly } = g.last;
        setUserView((prev) => panBy(prev ?? fittedRef.current, point.x - lx, point.y - ly));
      }
      g.last = point;
    };

    const onUp = (event: PointerEvent) => {
      if (!g.pointers.delete(event.pointerId)) return;
      g.pinch = null;
      const rest = [...g.pointers.values()][0];
      if (rest) {
        g.last = rest;
        g.down = rest;
      }
      // Sürükleme sonrası gelen "click" masa seçimine dönüşmesin; bayrak olaydan sonra temizlenir.
      if (g.pointers.size === 0) setTimeout(() => (g.moved = false), 0);
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!g.moved) return;
      event.stopPropagation();
      event.preventDefault();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const current = viewRef.current;
      setUserView(zoomAround(current, anchor, current.scale * (event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP)));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const current = viewRef.current;
      setUserView(zoomAround(current, { x: size.width / 2, y: size.height / 2 }, current.scale * factor));
    },
    [size],
  );

  return {
    ref,
    view,
    zoomIn: useCallback(() => zoomBy(BUTTON_STEP), [zoomBy]),
    zoomOut: useCallback(() => zoomBy(1 / BUTTON_STEP), [zoomBy]),
    fit: useCallback(() => setUserView(null), []),
  };
}
