"use client";

import { Redo2, Undo2 } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { historyShortcut } from "../history";
import { useOrganization, useOrganizationStoreApi } from "./store";

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "number", "tel", "url", "password", "time", "date"]);

/** Odak metin alanındaysa tarayıcının kendi geri alması çalışsın. */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
}

/** Geri al / Yinele düğmeleri ve Ctrl+Z, Ctrl+Y (Ctrl+Shift+Z) kısayolları. */
export function HistoryControls() {
  const store = useOrganizationStoreApi();
  const canUndo = useOrganization((s) => s.history.past.length > 0);
  const canRedo = useOrganization((s) => s.history.future.length > 0);
  const undo = useOrganization((s) => s.undo);
  const redo = useOrganization((s) => s.redo);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const action = historyShortcut({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        inTextField: isTextField(e.target),
      });
      if (!action) return;
      e.preventDefault();
      if (action === "undo") store.getState().undo();
      else store.getState().redo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);

  return (
    <div role="group" aria-label="Değişiklik geçmişi" className="flex gap-1">
      <Button variant="outline" size="sm" disabled={!canUndo} onClick={undo} title="Geri al (Ctrl+Z)">
        <Undo2 aria-hidden className="size-4" />
        Geri al
      </Button>
      <Button variant="outline" size="sm" disabled={!canRedo} onClick={redo} title="Yinele (Ctrl+Y)">
        <Redo2 aria-hidden className="size-4" />
        Yinele
      </Button>
    </div>
  );
}
