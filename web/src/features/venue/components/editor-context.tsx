"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { EditorActions, EditorState, EditorStore } from "../editor/store";

export type TableTypeOption = {
  id: string;
  name: string;
  color: string;
  shape: string;
  capacity: number;
  isActive: boolean;
};

export const EditorStoreContext = createContext<EditorStore | null>(null);

export function useEditorStore(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error("EditorStoreContext eksik");
  return store;
}

/** Düzenleyici durumunun tek kaynağı (Zustand); bileşenler yalnızca ihtiyaç duydukları dilimi seçer. */
export function useEditor<T>(selector: (state: EditorState & EditorActions) => T): T {
  return useStore(useEditorStore(), selector);
}

export const DEFAULT_TABLE_COLOR = "#3b82f6";
export const LOCA_COLOR = "#ec4899";

export function tableShapeOf(type: TableTypeOption | undefined): "round" | "rectangle" | "square" {
  return type?.shape === "rectangle" || type?.shape === "square" ? type.shape : "round";
}
