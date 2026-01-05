import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type {
  PlacedTable,
  StageElement,
  AreaEditState,
  ContextMenuState,
  TableType,
  CanvasTool,
  AddElementWizardState,
  LassoState,
  TableResizeState,
  SpacingState,
  LocaNameEditState,
} from "../types";
import {
  DEFAULT_AREA_EDIT,
  DEFAULT_ADD_WIZARD,
  CELL_SIZE,
  gridToPixel,
  getGridCellCenter,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_COLS,
  DEFAULT_TABLE_SIZE,
} from "../constants";
import { useToast } from "@/components/ui/toast-notification";

// Default states
const DEFAULT_LASSO: LassoState = {
  isActive: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
};

const DEFAULT_TABLE_RESIZE: TableResizeState = {
  isOpen: false,
  targetIds: [],
  currentSize: DEFAULT_TABLE_SIZE,
};

const DEFAULT_SPACING: SpacingState = {
  isOpen: false,
  targetIds: [],
  currentSpacing: 16,
};

const DEFAULT_LOCA_NAME_EDIT: LocaNameEditState = {
  isOpen: false,
  locaId: null,
  locaName: "",
};

// Auto-draft interval (30 saniye)
const AUTO_DRAFT_INTERVAL = 30000;

// LocalStorage key generator
const getDraftKey = (eventId: string) => `venue-draft-${eventId}`;

interface VenueDraft {
  placedTables: PlacedTable[];
  stageElements: StageElement[];
  savedAt: number;
}

export function useVenueState(eventId?: string) {
  const toast = useToast();

  // Core state
  const [placedTables, setPlacedTables] = useState<PlacedTable[]>([]);
  const [stageElements, setStageElements] = useState<StageElement[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // UI state
  const [zoom, setZoom] = useState(1.0);
  const [gridSnap, setGridSnap] = useState(true);
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [selectedAssignType, setSelectedAssignType] =
    useState<TableType>("vip");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGuideLines, setShowGuideLines] = useState(true);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

  // Lasso selection state
  const [lasso, setLasso] = useState<LassoState>(DEFAULT_LASSO);

  // Table resize state
  const [tableResize, setTableResize] =
    useState<TableResizeState>(DEFAULT_TABLE_RESIZE);

  // Spacing state
  const [spacing, setSpacing] = useState<SpacingState>(DEFAULT_SPACING);

  // Loca name edit state
  const [locaNameEdit, setLocaNameEdit] = useState<LocaNameEditState>(
    DEFAULT_LOCA_NAME_EDIT
  );

  // Modal state
  const [areaEdit, setAreaEdit] = useState<AreaEditState>(DEFAULT_AREA_EDIT);
  const [addWizard, setAddWizard] =
    useState<AddElementWizardState>(DEFAULT_ADD_WIZARD);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    canvasX: 0,
    canvasY: 0,
    gridCol: "A",
    gridRow: 1,
    targetId: null,
    targetType: null,
  });

  // Draft state
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const lastSavedRef = useRef<string>("");

  // ==================== AUTO-DRAFT SYSTEM ====================
  // Taslak kaydet
  const saveDraft = useCallback(() => {
    if (!eventId) return;

    const draft: VenueDraft = {
      placedTables,
      stageElements,
      savedAt: Date.now(),
    };

    const draftStr = JSON.stringify(draft);

    // Değişiklik yoksa kaydetme
    if (draftStr === lastSavedRef.current) return;

    try {
      localStorage.setItem(getDraftKey(eventId), draftStr);
      lastSavedRef.current = draftStr;
      setDraftSavedAt(new Date());
      setHasDraft(true);
    } catch (e) {
      console.error("Draft kaydetme hatası:", e);
    }
  }, [eventId, placedTables, stageElements]);

  // Taslak yükle
  const loadDraft = useCallback((): VenueDraft | null => {
    if (!eventId) return null;

    try {
      const draftStr = localStorage.getItem(getDraftKey(eventId));
      if (!draftStr) return null;

      const draft = JSON.parse(draftStr) as VenueDraft;
      return draft;
    } catch (e) {
      console.error("Draft yükleme hatası:", e);
      return null;
    }
  }, [eventId]);

  // Taslağı uygula
  const applyDraft = useCallback(() => {
    const draft = loadDraft();
    if (!draft) return false;

    setPlacedTables(draft.placedTables);
    setStageElements(draft.stageElements);
    toast.success("Taslak yüklendi");
    return true;
  }, [loadDraft, toast]);

  // Taslağı sil
  const clearDraft = useCallback(() => {
    if (!eventId) return;

    try {
      localStorage.removeItem(getDraftKey(eventId));
      setHasDraft(false);
      setDraftSavedAt(null);
      lastSavedRef.current = "";
    } catch (e) {
      console.error("Draft silme hatası:", e);
    }
  }, [eventId]);

  // Taslak var mı kontrol et
  const checkDraft = useCallback((): {
    hasDraft: boolean;
    savedAt: Date | null;
  } => {
    const draft = loadDraft();
    if (!draft) return { hasDraft: false, savedAt: null };
    return { hasDraft: true, savedAt: new Date(draft.savedAt) };
  }, [loadDraft]);

  // Otomatik taslak kayıt (30 saniyede bir)
  useEffect(() => {
    if (!eventId) return;

    const interval = setInterval(() => {
      if (placedTables.length > 0 || stageElements.length > 0) {
        saveDraft();
      }
    }, AUTO_DRAFT_INTERVAL);

    return () => clearInterval(interval);
  }, [eventId, placedTables, stageElements, saveDraft]);

  // Sayfa kapatılmadan önce kaydet
  useEffect(() => {
    if (!eventId) return;

    const handleBeforeUnload = () => {
      if (placedTables.length > 0 || stageElements.length > 0) {
        const draft: VenueDraft = {
          placedTables,
          stageElements,
          savedAt: Date.now(),
        };
        localStorage.setItem(getDraftKey(eventId), JSON.stringify(draft));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [eventId, placedTables, stageElements]);

  // Component mount'ta taslak kontrolü
  useEffect(() => {
    if (!eventId) return;

    const { hasDraft: exists, savedAt } = checkDraft();
    setHasDraft(exists);
    setDraftSavedAt(savedAt);
  }, [eventId, checkDraft]);

  // Computed
  const selectedItemsSet = useMemo(
    () => new Set(selectedItems),
    [selectedItems]
  );
  const tableStats = useMemo(() => {
    const stats: Record<TableType, { count: number; capacity: number }> = {
      unassigned: { count: 0, capacity: 0 },
      standard: { count: 0, capacity: 0 },
      premium: { count: 0, capacity: 0 },
      vip: { count: 0, capacity: 0 },
      loca: { count: 0, capacity: 0 },
    };
    let totalCapacity = 0;
    for (const table of placedTables) {
      if (stats[table.type]) {
        stats[table.type].count++;
        stats[table.type].capacity += table.capacity;
        totalCapacity += table.capacity;
      }
    }
    return { stats, totalCapacity };
  }, [placedTables]);

  // Add element functions
  const addStage = useCallback(
    (canvasX: number, canvasY: number, gridCol: string, gridRow: number) => {
      const snappedX = gridSnap ? gridToPixel(gridCol, gridRow).x : canvasX;
      const snappedY = gridSnap ? gridToPixel(gridCol, gridRow).y : canvasY;
      const newStage: StageElement = {
        id: `stage-${Date.now()}`,
        type: "stage",
        x: snappedX,
        y: snappedY,
        width: CELL_SIZE * 5,
        height: CELL_SIZE * 2,
        label: "Sahne",
        displayText: "",
        isLocked: false,
        gridCol,
        gridRow,
        color: "#dc2626",
        borderColor: "#f87171",
        borderWidth: 2,
        iconId: "mic",
        fontSize: "md",
        fontFamily: "sans",
        textDirection: "horizontal",
      };
      setStageElements((prev) => [...prev, newStage]);
      toast.success(`Sahne eklendi: ${gridCol}${gridRow}`);
      return newStage;
    },
    [gridSnap, toast]
  );

  const addArea = useCallback(
    (canvasX: number, canvasY: number, gridCol: string, gridRow: number) => {
      const snappedX = gridSnap ? gridToPixel(gridCol, gridRow).x : canvasX;
      const snappedY = gridSnap ? gridToPixel(gridCol, gridRow).y : canvasY;
      const newArea: StageElement = {
        id: `area-${Date.now()}`,
        type: "area",
        x: snappedX,
        y: snappedY,
        width: CELL_SIZE * 2,
        height: CELL_SIZE * 2,
        label: "Yeni Alan",
        displayText: "",
        isLocked: false,
        gridCol,
        gridRow,
        color: "#3b82f6",
        borderColor: "#60a5fa",
        borderWidth: 2,
        iconId: "none",
        fontSize: "md",
        fontFamily: "sans",
        textDirection: "horizontal",
      };
      setStageElements((prev) => [...prev, newArea]);
      setAreaEdit({
        isOpen: true,
        stageId: newArea.id,
        label: newArea.label,
        displayText: newArea.displayText || "",
        color: newArea.color!,
        borderColor: newArea.borderColor!,
        borderWidth: newArea.borderWidth || 2,
        iconId: newArea.iconId!,
        fontSize: newArea.fontSize || "md",
        fontFamily: newArea.fontFamily || "sans",
        textDirection: newArea.textDirection || "horizontal",
      });
      toast.success(`Alan eklendi: ${gridCol}${gridRow}`);
      return newArea;
    },
    [gridSnap, toast]
  );

  const addTable = useCallback(
    (canvasX: number, canvasY: number, gridCol: string, gridRow: number) => {
      const center = gridSnap
        ? getGridCellCenter(gridCol, gridRow)
        : { x: canvasX - 16, y: canvasY - 16 };
      const maxNumber = Math.max(
        ...placedTables.filter((t) => !t.isLoca).map((t) => t.tableNumber),
        0
      );
      const newTable: PlacedTable = {
        id: `table-${Date.now()}`,
        tableNumber: maxNumber + 1,
        type: "unassigned",
        capacity: 12,
        x: center.x,
        y: center.y,
        isLoca: false,
        isLocked: false,
        gridCol,
        gridRow,
      };
      setPlacedTables((prev) => [...prev, newTable]);
      toast.success(`Masa ${maxNumber + 1} eklendi: ${gridCol}${gridRow}`);
      return newTable;
    },
    [gridSnap, placedTables, toast]
  );

  const addLoca = useCallback(
    (canvasX: number, canvasY: number, gridCol: string, gridRow: number) => {
      const snappedX = gridSnap ? gridToPixel(gridCol, gridRow).x : canvasX;
      const snappedY = gridSnap ? gridToPixel(gridCol, gridRow).y : canvasY;
      const locaCount = placedTables.filter((t) => t.isLoca).length;
      const newLoca: PlacedTable = {
        id: `loca-${Date.now()}`,
        tableNumber: 1000 + locaCount,
        type: "loca",
        capacity: 6,
        x: snappedX,
        y: snappedY,
        isLoca: true,
        locaName: `L${locaCount + 1}`,
        isLocked: false,
        gridCol,
        gridRow,
      };
      setPlacedTables((prev) => [...prev, newLoca]);
      toast.success(`Loca eklendi: ${gridCol}${gridRow}`);
      return newLoca;
    },
    [gridSnap, placedTables, toast]
  );

  // Stage/Area actions
  const centerStageHorizontally = useCallback(
    (stageId: string) => {
      setStageElements((prev) =>
        prev.map((el) =>
          el.id === stageId ? { ...el, x: (CANVAS_WIDTH - el.width) / 2 } : el
        )
      );
      toast.success("Sahne yatay olarak ortalandı");
    },
    [toast]
  );

  const deleteStageElement = useCallback(
    (stageId: string) => {
      setStageElements((prev) => prev.filter((el) => el.id !== stageId));
      setSelectedItems((prev) => prev.filter((id) => id !== stageId));
      toast.success("Element silindi");
    },
    [toast]
  );

  const toggleStageLock = useCallback(
    (stageId: string) => {
      setStageElements((prev) =>
        prev.map((el) =>
          el.id === stageId ? { ...el, isLocked: !el.isLocked } : el
        )
      );
      const stage = stageElements.find((s) => s.id === stageId);
      toast.success(
        stage?.isLocked ? "Kilit kaldırıldı" : "Element sabitlendi"
      );
    },
    [stageElements, toast]
  );

  const toggleTableLock = useCallback(
    (tableId: string) => {
      setPlacedTables((prev) =>
        prev.map((t) =>
          t.id === tableId ? { ...t, isLocked: !t.isLocked } : t
        )
      );
      const table = placedTables.find((t) => t.id === tableId);
      toast.success(
        table?.isLocked ? "Kilit kaldırıldı" : "Element sabitlendi"
      );
    },
    [placedTables, toast]
  );

  const deleteTable = useCallback(
    (tableId: string) => {
      setPlacedTables((prev) => prev.filter((t) => t.id !== tableId));
      setSelectedItems((prev) => prev.filter((id) => id !== tableId));
      toast.success("Element silindi");
    },
    [toast]
  );

  // ==================== ÇOKLU SEÇİM İŞLEMLERİ ====================
  const lockSelectedItems = useCallback(() => {
    if (selectedItems.length === 0) return;

    setPlacedTables((prev) =>
      prev.map((t) =>
        selectedItems.includes(t.id) ? { ...t, isLocked: true } : t
      )
    );
    setStageElements((prev) =>
      prev.map((s) =>
        selectedItems.includes(s.id) ? { ...s, isLocked: true } : s
      )
    );
    toast.success(`${selectedItems.length} element sabitlendi`);
  }, [selectedItems, toast]);

  const unlockSelectedItems = useCallback(() => {
    if (selectedItems.length === 0) return;

    setPlacedTables((prev) =>
      prev.map((t) =>
        selectedItems.includes(t.id) ? { ...t, isLocked: false } : t
      )
    );
    setStageElements((prev) =>
      prev.map((s) =>
        selectedItems.includes(s.id) ? { ...s, isLocked: false } : s
      )
    );
    toast.success(`${selectedItems.length} elementin kilidi açıldı`);
  }, [selectedItems, toast]);

  const deleteSelectedItems = useCallback(() => {
    if (selectedItems.length === 0) return;

    const count = selectedItems.length;
    setPlacedTables((prev) =>
      prev.filter((t) => !selectedItems.includes(t.id))
    );
    setStageElements((prev) =>
      prev.filter((s) => !selectedItems.includes(s.id))
    );
    setSelectedItems([]);
    toast.success(`${count} element silindi`);
  }, [selectedItems, toast]);

  const openAreaEditModal = useCallback(
    (stageId: string) => {
      const stage = stageElements.find((s) => s.id === stageId);
      if (!stage) return;
      setAreaEdit({
        isOpen: true,
        stageId,
        label: stage.label,
        displayText: stage.displayText || "",
        color: stage.color || "#3b82f6",
        borderColor: stage.borderColor || "#60a5fa",
        borderWidth: stage.borderWidth || 2,
        iconId: stage.iconId || "none",
        fontSize: stage.fontSize || "md",
        fontFamily: stage.fontFamily || "sans",
        textDirection: stage.textDirection || "horizontal",
      });
    },
    [stageElements]
  );

  const saveAreaEdit = useCallback(() => {
    if (!areaEdit.stageId) return;
    setStageElements((prev) =>
      prev.map((el) =>
        el.id === areaEdit.stageId
          ? {
              ...el,
              label: areaEdit.label,
              displayText: areaEdit.displayText,
              color: areaEdit.color,
              borderColor: areaEdit.borderColor,
              borderWidth: areaEdit.borderWidth,
              iconId: areaEdit.iconId,
              fontSize: areaEdit.fontSize,
              fontFamily: areaEdit.fontFamily,
              textDirection: areaEdit.textDirection,
            }
          : el
      )
    );
    setAreaEdit((prev) => ({ ...prev, isOpen: false }));
    toast.success("Güncellendi");
  }, [areaEdit, toast]);

  const assignTableType = useCallback((tableId: string, type: TableType) => {
    setPlacedTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, type } : t))
    );
  }, []);

  const assignSelectedTablesType = useCallback(
    (type: TableType) => {
      if (selectedItems.length === 0) return;
      setPlacedTables((prev) =>
        prev.map((t) => (selectedItems.includes(t.id) ? { ...t, type } : t))
      );
      toast.success(`${selectedItems.length} masa atandı`);
    },
    [selectedItems, toast]
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  // ==================== WIZARD FUNCTIONS ====================
  const openAddWizard = useCallback(
    (
      type: "table" | "loca",
      canvasX: number,
      canvasY: number,
      gridCol: string,
      gridRow: number
    ) => {
      setAddWizard({
        isOpen: true,
        elementType: type,
        step: 1,
        count: 1,
        tableType: type === "loca" ? "loca" : "standard",
        capacity: type === "loca" ? 6 : 10,
        floor: type === "loca" ? 2 : 1, // Localar default 2. kat
        startPosition: { x: canvasX, y: canvasY, col: gridCol, row: gridRow },
      });
    },
    []
  );

  const closeAddWizard = useCallback(() => {
    setAddWizard(DEFAULT_ADD_WIZARD);
  }, []);

  const nextWizardStep = useCallback(() => {
    setAddWizard((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, 3) as 1 | 2 | 3 | 4,
    }));
  }, []);

  const prevWizardStep = useCallback(() => {
    setAddWizard((prev) => ({
      ...prev,
      step: Math.max(prev.step - 1, 1) as 1 | 2 | 3 | 4,
    }));
  }, []);

  // Smart placement: Engelleri (sahne/alan) atlayarak masaları yerleştir
  // 1. satırdan başlar, 100 masa limiti
  const addBulkElements = useCallback(() => {
    const { elementType, count, tableType, capacity } = addWizard;
    if (!elementType || count < 1) return;

    const TABLE_SIZE = DEFAULT_TABLE_SIZE;
    const PADDING = 16; // Yatay ve dikey boşluk
    const ROW_GAP = TABLE_SIZE + PADDING; // Satırlar arası: masa boyutu + aralık

    // Tüm engelleri topla (sahne + alanlar + mevcut masalar)
    const obstacles: { x: number; y: number; width: number; height: number }[] =
      [];

    stageElements.forEach((el) => {
      obstacles.push({
        x: el.x - PADDING,
        y: el.y - PADDING,
        width: el.width + PADDING * 2,
        height: el.height + PADDING * 2,
      });
    });

    placedTables.forEach((t) => {
      const size = t.size || DEFAULT_TABLE_SIZE;
      obstacles.push({
        x: t.x - PADDING,
        y: t.y - PADDING,
        width: size + PADDING * 2,
        height: size + PADDING * 2,
      });
    });

    // A ve Z sütunları boş kalacak - B sütunundan başla, Y sütununda bitir
    const startY = CELL_SIZE; // 1. satır
    const startX = CELL_SIZE * 2; // B sütunu (A boş)
    const maxX = CANVAS_WIDTH - CELL_SIZE * 2 - TABLE_SIZE; // Y sütunu sonu (Z boş)

    const isBlocked = (x: number, y: number): boolean => {
      const testRect = { x, y, width: TABLE_SIZE, height: TABLE_SIZE };
      return obstacles.some(
        (obs) =>
          !(
            testRect.x + testRect.width <= obs.x ||
            testRect.x >= obs.x + obs.width ||
            testRect.y + testRect.height <= obs.y ||
            testRect.y >= obs.y + obs.height
          )
      );
    };

    const maxTableNum = Math.max(
      ...placedTables.filter((t) => !t.isLoca).map((t) => t.tableNumber),
      0
    );
    const maxLocaNum = placedTables.filter((t) => t.isLoca).length;

    const newElements: PlacedTable[] = [];
    let currentX = startX;
    let currentY = startY;
    let placedCount = 0;
    let maxIterations = count * 100; // 100 masa için artırıldı

    while (placedCount < count && maxIterations > 0) {
      maxIterations--;

      if (currentX > maxX) {
        currentX = startX;
        currentY += ROW_GAP;
      }

      if (currentY > CANVAS_HEIGHT - CELL_SIZE) {
        toast.warning(
          `Yeterli alan yok! ${placedCount}/${count} element yerleştirildi.`
        );
        break;
      }

      if (!isBlocked(currentX, currentY)) {
        if (elementType === "loca") {
          newElements.push({
            id: `loca-${Date.now()}-${placedCount}`,
            tableNumber: 1000 + maxLocaNum + placedCount,
            type: "loca",
            capacity,
            x: currentX,
            y: currentY,
            isLoca: true,
            locaName: `L${maxLocaNum + placedCount + 1}`,
            isLocked: false,
            size: DEFAULT_TABLE_SIZE,
            floor: addWizard.floor, // Kat bilgisi
          });
        } else {
          newElements.push({
            id: `table-${Date.now()}-${placedCount}`,
            tableNumber: maxTableNum + placedCount + 1,
            type: tableType,
            capacity,
            x: currentX,
            y: currentY,
            isLoca: false,
            isLocked: false,
            size: DEFAULT_TABLE_SIZE,
            floor: 1, // Masalar zemin katta
          });
        }

        obstacles.push({
          x: currentX - PADDING,
          y: currentY - PADDING,
          width: TABLE_SIZE + PADDING * 2,
          height: TABLE_SIZE + PADDING * 2,
        });

        placedCount++;
      }

      currentX += TABLE_SIZE + PADDING; // Masa boyutu + aralık
    }

    if (newElements.length > 0) {
      setPlacedTables((prev) => [...prev, ...newElements]);
      toast.success(
        `${newElements.length} ${
          elementType === "loca" ? "loca" : "masa"
        } eklendi`
      );
    }

    closeAddWizard();
  }, [addWizard, stageElements, placedTables, toast, closeAddWizard]);

  // ==================== LASSO SELECTION ====================
  const startLasso = useCallback((x: number, y: number) => {
    setLasso({
      isActive: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });
  }, []);

  const updateLasso = useCallback((x: number, y: number) => {
    setLasso((prev) =>
      prev.isActive ? { ...prev, currentX: x, currentY: y } : prev
    );
  }, []);

  const endLasso = useCallback(() => {
    if (!lasso.isActive) return;

    const minX = Math.min(lasso.startX, lasso.currentX);
    const maxX = Math.max(lasso.startX, lasso.currentX);
    const minY = Math.min(lasso.startY, lasso.currentY);
    const maxY = Math.max(lasso.startY, lasso.currentY);

    // Lasso alanı içindeki masaları seç
    const selectedTableIds = placedTables
      .filter((t) => {
        const size = t.size || DEFAULT_TABLE_SIZE;
        const centerX = t.x + size / 2;
        const centerY = t.y + size / 2;
        return (
          centerX >= minX &&
          centerX <= maxX &&
          centerY >= minY &&
          centerY <= maxY
        );
      })
      .map((t) => t.id);

    if (selectedTableIds.length > 0) {
      setSelectedItems(selectedTableIds);
      toast.success(`${selectedTableIds.length} masa seçildi`);
    }

    setLasso(DEFAULT_LASSO);
  }, [lasso, placedTables, toast]);

  const cancelLasso = useCallback(() => {
    setLasso(DEFAULT_LASSO);
  }, []);

  // ==================== TABLE RESIZE ====================
  const openTableResize = useCallback(
    (targetIds: string[]) => {
      if (targetIds.length === 0) return;
      const firstTable = placedTables.find((t) => t.id === targetIds[0]);
      setTableResize({
        isOpen: true,
        targetIds,
        currentSize: firstTable?.size || DEFAULT_TABLE_SIZE,
      });
    },
    [placedTables]
  );

  const closeTableResize = useCallback(() => {
    setTableResize(DEFAULT_TABLE_RESIZE);
  }, []);

  const applyTableResize = useCallback(
    (newSize: number) => {
      setPlacedTables((prev) =>
        prev.map((t) =>
          tableResize.targetIds.includes(t.id) ? { ...t, size: newSize } : t
        )
      );
      toast.success(`${tableResize.targetIds.length} masa boyutlandırıldı`);
      closeTableResize();
    },
    [tableResize.targetIds, toast, closeTableResize]
  );

  // Aynı tip ve kapasitedeki tüm masaları aynı boyutta yap
  const applySizeToSameTypeTables = useCallback(
    (sourceTableId: string) => {
      const sourceTable = placedTables.find((t) => t.id === sourceTableId);
      if (!sourceTable) return;

      const targetTables = placedTables.filter(
        (t) =>
          t.type === sourceTable.type && t.capacity === sourceTable.capacity
      );

      setPlacedTables((prev) =>
        prev.map((t) =>
          t.type === sourceTable.type && t.capacity === sourceTable.capacity
            ? { ...t, size: sourceTable.size || DEFAULT_TABLE_SIZE }
            : t
        )
      );

      toast.success(`${targetTables.length} masa aynı boyuta getirildi`);
    },
    [placedTables, toast]
  );

  // Ctrl+Click ile çoklu seçim toggle
  const toggleTableSelection = useCallback(
    (tableId: string, ctrlKey: boolean) => {
      if (ctrlKey) {
        setSelectedItems((prev) =>
          prev.includes(tableId)
            ? prev.filter((id) => id !== tableId)
            : [...prev, tableId]
        );
      } else {
        setSelectedItems([tableId]);
      }
    },
    []
  );

  // ==================== SPACING (ARALIK AYARLA) ====================
  const openSpacing = useCallback(
    (targetIds: string[]) => {
      if (targetIds.length < 2) {
        toast.warning("En az 2 masa seçmelisiniz");
        return;
      }
      setSpacing({
        isOpen: true,
        targetIds,
        currentSpacing: 16,
      });
    },
    [toast]
  );

  const closeSpacing = useCallback(() => {
    setSpacing(DEFAULT_SPACING);
  }, []);

  const applySpacing = useCallback(() => {
    if (spacing.targetIds.length < 2) return;

    const gap = spacing.currentSpacing;

    // Seçili masaları al - MASA NUMARASINA GÖRE SIRALA
    const selectedTables = placedTables
      .filter((t) => spacing.targetIds.includes(t.id))
      .sort((a, b) => a.tableNumber - b.tableNumber);

    if (selectedTables.length < 2) return;

    // Engeller: Stage elementleri (sahne, alan) + seçili olmayan masalar
    const obstacles: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    // Sahne ve alanları engel olarak ekle
    stageElements.forEach((s) => {
      obstacles.push({ x: s.x, y: s.y, width: s.width, height: s.height });
    });

    // Seçili olmayan masaları engel olarak ekle
    placedTables.forEach((t) => {
      if (!spacing.targetIds.includes(t.id)) {
        const size = t.size || DEFAULT_TABLE_SIZE;
        obstacles.push({ x: t.x, y: t.y, width: size, height: size });
      }
    });

    // Collision check helper
    const hasCollision = (x: number, y: number, size: number): boolean => {
      const padding = 4;
      for (const obs of obstacles) {
        if (
          x < obs.x + obs.width + padding &&
          x + size + padding > obs.x &&
          y < obs.y + obs.height + padding &&
          y + size + padding > obs.y
        ) {
          return true;
        }
      }
      // Canvas sınırları
      if (
        x < 0 ||
        y < 0 ||
        x + size > CANVAS_WIDTH ||
        y + size > CANVAS_HEIGHT
      ) {
        return true;
      }
      return false;
    };

    // Satır toleransı - yakın Y değerlerini aynı satır say
    const ROW_TOLERANCE = CELL_SIZE * 0.8;

    // Masaları mevcut Y pozisyonuna göre satırlara grupla (toleranslı)
    // Ama her satır içinde tableNumber'a göre sırala
    const rows: Array<typeof selectedTables> = [];
    const sortedByY = [...selectedTables].sort((a, b) => a.y - b.y);

    sortedByY.forEach((table) => {
      let addedToRow = false;
      for (const row of rows) {
        const rowY = row[0].y;
        if (Math.abs(table.y - rowY) <= ROW_TOLERANCE) {
          row.push(table);
          addedToRow = true;
          break;
        }
      }
      if (!addedToRow) {
        rows.push([table]);
      }
    });

    // Her satırı tableNumber'a göre sırala (X pozisyonuna değil!)
    rows.forEach((row) => row.sort((a, b) => a.tableNumber - b.tableNumber));

    // Satırları ilk masanın tableNumber'ına göre sırala
    rows.sort((a, b) => a[0].tableNumber - b[0].tableNumber);

    const newPositions = new Map<string, { x: number; y: number }>();

    // İlk satırın başlangıç pozisyonunu al
    const firstRowFirstTable = rows[0]?.[0];
    let currentY = firstRowFirstTable?.y ?? 0;
    let startX = firstRowFirstTable?.x ?? CELL_SIZE;

    // Her satır için masaları yeniden konumlandır
    rows.forEach((tablesInRow, rowIdx) => {
      let currentX = startX;
      let maxSizeInRow = 0;

      tablesInRow.forEach((table) => {
        const size = table.size || DEFAULT_TABLE_SIZE;
        maxSizeInRow = Math.max(maxSizeInRow, size);

        let targetX = currentX;
        let targetY = currentY;

        // Collision varsa boş yer ara
        let attempts = 0;
        while (hasCollision(targetX, targetY, size) && attempts < 100) {
          targetX += size + gap;
          // Satır sonuna geldiyse sonraki satıra geç
          if (targetX + size > CANVAS_WIDTH - CELL_SIZE) {
            targetX = CELL_SIZE;
            targetY += size + gap;
          }
          attempts++;
        }

        newPositions.set(table.id, { x: targetX, y: targetY });
        currentX = targetX + size + gap;
      });

      // Sonraki satır için Y pozisyonunu güncelle
      if (rowIdx < rows.length - 1) {
        currentY = currentY + maxSizeInRow + gap;
      }
    });

    setPlacedTables((prev) =>
      prev.map((t) => {
        const newPos = newPositions.get(t.id);
        if (newPos) {
          return { ...t, x: newPos.x, y: newPos.y };
        }
        return t;
      })
    );

    toast.success(
      `${selectedTables.length} masa arasındaki aralık ${gap}px olarak ayarlandı`
    );
    closeSpacing();
  }, [spacing, placedTables, stageElements, toast, closeSpacing]);

  // ==================== LOCA NAME EDIT ====================
  const openLocaNameEdit = useCallback(
    (locaId: string) => {
      const loca = placedTables.find((t) => t.id === locaId && t.isLoca);
      if (!loca) return;
      setLocaNameEdit({
        isOpen: true,
        locaId,
        locaName: loca.locaName || "",
      });
    },
    [placedTables]
  );

  const closeLocaNameEdit = useCallback(() => {
    setLocaNameEdit(DEFAULT_LOCA_NAME_EDIT);
  }, []);

  const saveLocaName = useCallback(() => {
    if (!locaNameEdit.locaId || !locaNameEdit.locaName.trim()) return;

    setPlacedTables((prev) =>
      prev.map((t) =>
        t.id === locaNameEdit.locaId
          ? { ...t, locaName: locaNameEdit.locaName.trim() }
          : t
      )
    );
    toast.success(`Loca ismi güncellendi: ${locaNameEdit.locaName.trim()}`);
    closeLocaNameEdit();
  }, [locaNameEdit, toast, closeLocaNameEdit]);

  return {
    // State
    placedTables,
    setPlacedTables,
    stageElements,
    setStageElements,
    selectedItems,
    setSelectedItems,
    zoom,
    setZoom,
    gridSnap,
    setGridSnap,
    activeTool,
    setActiveTool,
    selectedAssignType,
    setSelectedAssignType,
    isFullscreen,
    setIsFullscreen,
    showGuideLines,
    setShowGuideLines,
    canvasOffset,
    setCanvasOffset,
    areaEdit,
    setAreaEdit,
    addWizard,
    setAddWizard,
    contextMenu,
    setContextMenu,
    // Lasso state
    lasso,
    setLasso,
    // Table resize state
    tableResize,
    setTableResize,
    // Draft state
    hasDraft,
    draftSavedAt,
    // Computed
    selectedItemsSet,
    tableStats,
    // Actions
    addStage,
    addArea,
    addTable,
    addLoca,
    centerStageHorizontally,
    deleteStageElement,
    toggleStageLock,
    toggleTableLock,
    deleteTable,
    openAreaEditModal,
    saveAreaEdit,
    assignTableType,
    assignSelectedTablesType,
    closeContextMenu,
    // Wizard actions
    openAddWizard,
    closeAddWizard,
    nextWizardStep,
    prevWizardStep,
    addBulkElements,
    // Lasso actions
    startLasso,
    updateLasso,
    endLasso,
    cancelLasso,
    // Table resize actions
    openTableResize,
    closeTableResize,
    applyTableResize,
    applySizeToSameTypeTables,
    toggleTableSelection,
    // Draft actions
    saveDraft,
    loadDraft,
    applyDraft,
    clearDraft,
    checkDraft,
    // Çoklu seçim işlemleri
    lockSelectedItems,
    unlockSelectedItems,
    deleteSelectedItems,
    // Spacing (aralık ayarla)
    spacing,
    setSpacing,
    openSpacing,
    closeSpacing,
    applySpacing,
    // Loca name edit
    locaNameEdit,
    setLocaNameEdit,
    openLocaNameEdit,
    closeLocaNameEdit,
    saveLocaName,
  };
}
