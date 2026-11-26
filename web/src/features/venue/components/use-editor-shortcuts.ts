"use client";

import { useEffect } from "react";
import type { EditorLock } from "../editor/lock";
import type { EditorStore } from "../editor/store";
import { reportMove, runDelete, type Notify } from "./editor-commands";

type Options = {
  store: EditorStore;
  enabled: boolean;
  onSave: () => void;
  notify: Notify;
  lock: EditorLock;
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Klavye kısayolları: V/L seç, H kaydır, Sil, Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z), Ctrl+A, Ctrl+D, Ctrl+S, oklar, Esc. */
export function useEditorShortcuts({ store, enabled, onSave, notify, lock }: Options): void {
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
        runDelete(store, notify, lock);
      } else if (!mod && !e.altKey && key === "v") {
        s.setTool("select");
      } else if (!mod && !e.altKey && key === "l") {
        // Seçim aracı zaten sürükleyerek çerçeve seçimi yapar; L onu etkinleştirir.
        s.setTool("select");
      } else if (!mod && !e.altKey && key === "h") {
        s.setTool("pan");
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
  }, [store, enabled, onSave, notify, lock]);
}
