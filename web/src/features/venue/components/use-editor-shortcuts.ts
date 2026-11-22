"use client";

import { useEffect } from "react";
import type { EditorStore } from "../editor/store";
import { reportMove, type Notify } from "./editor-commands";

type Options = {
  store: EditorStore;
  enabled: boolean;
  onSave: () => void;
  onBlocked: (labels: string[]) => void;
  notify: Notify;
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Klavye kısayolları: Sil, Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z), Ctrl+A, Ctrl+D, Ctrl+S, oklar, Esc. */
export function useEditorShortcuts({ store, enabled, onSave, onBlocked, notify }: Options): void {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target)) return;
      const s = store.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        s.redo();
      } else if (mod && key === "a") {
        e.preventDefault();
        s.selectAll();
      } else if (mod && key === "d") {
        e.preventDefault();
        s.duplicateSelection();
      } else if (mod && key === "s") {
        e.preventDefault();
        onSave();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selection.length === 0) return;
        e.preventDefault();
        const { blocked } = s.deleteSelection();
        if (blocked.length > 0) onBlocked(blocked);
      } else if (e.key === "Escape") {
        s.clearSelection();
      } else if (e.key.startsWith("Arrow") && s.selection.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : s.gridSize;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        reportMove(s.nudge(dx, dy), notify);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, enabled, onSave, onBlocked, notify]);
}
