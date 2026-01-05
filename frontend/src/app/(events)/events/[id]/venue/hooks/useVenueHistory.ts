import { useState, useCallback } from "react";
import type { PlacedTable, StageElement, HistoryState } from "../types";

const MAX_HISTORY = 30;

export function useVenueHistory(
  placedTables: PlacedTable[],
  stageElements: StageElement[],
  setPlacedTables: React.Dispatch<React.SetStateAction<PlacedTable[]>>,
  setStageElements: React.Dispatch<React.SetStateAction<StageElement[]>>
) {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const saveToHistory = useCallback(() => {
    const newState: HistoryState = {
      placedTables: placedTables.map((t) => ({ ...t })),
      stageElements: stageElements.map((s) => ({ ...s })),
    };
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newState);
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [placedTables, stageElements, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setPlacedTables(prevState.placedTables);
      setStageElements(prevState.stageElements);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, setPlacedTables, setStageElements]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setPlacedTables(nextState.placedTables);
      setStageElements(nextState.stageElements);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, setPlacedTables, setStageElements]);

  const initHistory = useCallback(
    (tables: PlacedTable[], stages: StageElement[]) => {
      setHistory([{ placedTables: tables, stageElements: stages }]);
      setHistoryIndex(0);
    },
    []
  );

  return {
    history,
    historyIndex,
    saveToHistory,
    undo,
    redo,
    initHistory,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  };
}
