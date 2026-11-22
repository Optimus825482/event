"use client";

import { useRef, type Dispatch, type KeyboardEvent, type PointerEvent } from "react";
import { withFieldValues, type FieldValues, type InvitationElement } from "../../elements";
import { ElementBody, elementCss } from "../invitation-surface";
import type { EditorAction, EditorDesign } from "./editor-state";

type Gesture =
  | { kind: "move"; id: string; startX: number; startY: number; originX: number; originY: number }
  | { kind: "resize"; id: string; startX: number; startY: number; originW: number; originH: number };

type Props = {
  design: EditorDesign;
  selectedId: string | null;
  zoom: number;
  fields: FieldValues;
  imageSrc: (uploadPath: string) => string;
  dispatch: Dispatch<EditorAction>;
};

const STEP = 1;
const BIG_STEP = 10;

export function EditorCanvas({ design, selectedId, zoom, fields, imageSrc, dispatch }: Props) {
  const gesture = useRef<Gesture | null>(null);

  function begin(event: PointerEvent<HTMLElement>, element: InvitationElement, kind: Gesture["kind"]) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dispatch({ type: "select", id: element.id });
    gesture.current =
      kind === "move"
        ? { kind, id: element.id, startX: event.clientX, startY: event.clientY, originX: element.x, originY: element.y }
        : { kind, id: element.id, startX: event.clientX, startY: event.clientY, originW: element.width, originH: element.height };
  }

  function drag(event: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = (event.clientX - g.startX) / zoom;
    const dy = (event.clientY - g.startY) / zoom;
    if (g.kind === "move") dispatch({ type: "move", id: g.id, x: g.originX + dx, y: g.originY + dy });
    else dispatch({ type: "resize", id: g.id, width: g.originW + dx, height: g.originH + dy });
  }

  function end() {
    gesture.current = null;
  }

  function onKey(event: KeyboardEvent<HTMLElement>, element: InvitationElement) {
    const step = event.shiftKey ? BIG_STEP : STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = moves[event.key];
    if (delta) {
      event.preventDefault();
      dispatch({ type: "move", id: element.id, x: element.x + delta[0], y: element.y + delta[1] });
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      dispatch({ type: "remove", id: element.id });
    }
  }

  const sorted = [...design.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return (
    <div className="overflow-auto rounded-xl border border-slate-700 bg-slate-900/60 p-4" style={{ maxHeight: "75vh" }}>
      <div style={{ width: design.width * zoom, height: design.height * zoom }}>
        <div
          data-testid="invitation-canvas"
          onPointerDown={() => dispatch({ type: "select", id: null })}
          style={{
            position: "relative",
            width: design.width,
            height: design.height,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            backgroundColor: design.backgroundColor ?? "#FFFFFF",
            backgroundImage: design.backgroundImage ? `url("${imageSrc(design.backgroundImage)}")` : (design.backgroundGradient ?? undefined),
            backgroundSize: "cover",
            backgroundPosition: "center",
            overflow: "hidden",
          }}
        >
          {sorted.map((element) => {
            const selected = element.id === selectedId;
            const shown = withFieldValues(element, fields);
            return (
              <div
                key={element.id}
                role="button"
                tabIndex={0}
                aria-label={`${element.type} öğesi${selected ? " (seçili)" : ""}`}
                aria-pressed={selected}
                onPointerDown={(e) => begin(e, element, "move")}
                onPointerMove={drag}
                onPointerUp={end}
                onPointerCancel={end}
                onKeyDown={(e) => onKey(e, element)}
                onFocus={() => dispatch({ type: "select", id: element.id })}
                style={{
                  ...elementCss(shown),
                  cursor: "move",
                  touchAction: "none",
                  outline: selected ? "2px solid #2563eb" : "1px dashed rgba(100,116,139,0.5)",
                  overflow: "visible",
                }}
              >
                <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
                  <ElementBody element={shown} imageSrc={imageSrc} />
                </div>
                {selected ? (
                  <span
                    aria-hidden
                    onPointerDown={(e) => begin(e, element, "resize")}
                    onPointerMove={drag}
                    onPointerUp={end}
                    onPointerCancel={end}
                    style={{ position: "absolute", right: -6, bottom: -6, width: 12, height: 12, background: "#2563eb", cursor: "nwse-resize", touchAction: "none" }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
