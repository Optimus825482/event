"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Layout,
  Loader2,
  Users,
  Check,
  Save,
  Trash2,
  Calendar,
  Clock,
  Grid3X3,
  Magnet,
  ChevronRight,
  ChevronLeft,
  Square,
  Star,
  Crown,
  Theater,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Settings,
  MousePointer2,
  Hand,
  Undo2,
  Redo2,
  Pencil,
  Eraser,
  Maximize2,
  Minimize2,
  Circle,
  Sofa,
  Download,
  Upload,
  FolderOpen,
} from "lucide-react";
import { eventsApi, venuesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/PageContainer";
import { useToast } from "@/components/ui/toast-notification";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ==================== TYPES ====================
type TableType = "standard" | "premium" | "vip" | "loca" | "unassigned";
type StageConfig = "full" | "no_catwalk2" | "no_catwalks";
type PlanStep = "tables" | "stage" | "layout";
type CanvasTool = "select" | "pan" | "draw" | "eraser" | "assign";

interface DrawnLine {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface TablePlan {
  id: string;
  type: TableType;
  capacity: number;
  count: number;
}

interface PlacedTable {
  id: string;
  tableNumber: number;
  type: TableType;
  capacity: number;
  x: number;
  y: number;
  isLoca: boolean;
  locaName?: string;
  isLocked: boolean;
}

interface StageElement {
  id: string;
  type: "stage" | "catwalk1" | "catwalk2" | "system_control";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  isLocked: boolean;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetId: string | null;
  targetType: "table" | "stage" | "canvas" | null;
}

interface HistoryState {
  placedTables: PlacedTable[];
  stageElements: StageElement[];
  drawnLines: DrawnLine[];
}

interface VenueTemplate {
  id: string;
  name: string;
  description?: string;
  layoutData: any;
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
}

interface Event {
  id: string;
  name: string;
  eventDate: string;
  eventType?: string;
  venueLayout?: any;
}

// ==================== CONSTANTS ====================
const TABLE_TYPE_CONFIG = {
  unassigned: {
    label: "Atanmamış",
    icon: Circle,
    color: "#6b7280",
    borderColor: "#9ca3af",
  },
  standard: {
    label: "Standart",
    icon: Square,
    color: "#3b82f6",
    borderColor: "#60a5fa",
  },
  premium: {
    label: "Premium",
    icon: Star,
    color: "#8b5cf6",
    borderColor: "#a78bfa",
  },
  vip: {
    label: "VIP",
    icon: Crown,
    color: "#f59e0b",
    borderColor: "#fbbf24",
  },
  loca: {
    label: "Loca",
    icon: Sofa,
    color: "#ec4899",
    borderColor: "#f472b6",
  },
};

// Canvas boyutları - %100 zoom'da ekrana sığacak şekilde optimize edildi
const CANVAS_WIDTH = 1050;
const CANVAS_HEIGHT = 680;
const GRID_SIZE = 43; // Grid boyutu
const TABLE_RADIUS = 25; // Masa boyutu 38px için yarıçap
const LOCA_WIDTH = 20; // Küçültüldü
const LOCA_HEIGHT = 18; // Küçültüldü

// Loca isimleri (soldan sağa)
const LOCA_NAMES = [
  "9B",
  "9A",
  "8B",
  "8A",
  "7",
  "6",
  "5",
  "4",
  "3B",
  "3A",
  "2",
  "1",
];

// ==================== DEFAULT LAYOUT GENERATOR ====================
// Merit Royal Diamond Ballroom Planı - Referans görsele birebir uyumlu
const generateDefaultLayout = (
  stageConfig: StageConfig
): { tables: PlacedTable[]; stages: StageElement[] } => {
  const tables: PlacedTable[] = [];
  const stages: StageElement[] = [];

  // Merit Royal Diamond Ballroom ölçüleri
  const spacing = 43; // Grid spacing
  const centerX = CANVAS_WIDTH / 2;
  const startY = 15;

  // ===== SAHNE (7 masa genişlik x 2 masa yükseklik) =====
  const stageWidth = 7 * spacing;
  const stageHeight = 2 * spacing;
  const stageX = centerX - stageWidth / 2;
  const stageY = startY;

  stages.push({
    id: "stage-main",
    type: "stage",
    x: stageX,
    y: stageY,
    width: stageWidth,
    height: stageHeight,
    label: "SAHNE",
    isLocked: false,
  });

  // ===== CATWALK-1 (Dikey - sahnenin altında) =====
  const catwalk1Width = 2 * spacing;
  const catwalk1Height = 2 * spacing;
  const catwalk1X = centerX - catwalk1Width / 2;
  const catwalk1Y = stageY + stageHeight + 5;

  if (stageConfig === "full" || stageConfig === "no_catwalk2") {
    stages.push({
      id: "catwalk-1",
      type: "catwalk1",
      x: catwalk1X,
      y: catwalk1Y,
      width: catwalk1Width,
      height: catwalk1Height,
      label: "",
      isLocked: false,
    });
  }

  // ===== CATWALK-2 (Yatay T - catwalk1'in altında) =====
  const catwalk2Width = 7 * spacing;
  const catwalk2Height = spacing;
  const catwalk2X = centerX - catwalk2Width / 2;
  const catwalk2Y = catwalk1Y + catwalk1Height + 5;

  if (stageConfig === "full") {
    stages.push({
      id: "catwalk-2",
      type: "catwalk2",
      x: catwalk2X,
      y: catwalk2Y,
      width: catwalk2Width,
      height: catwalk2Height,
      label: "",
      isLocked: false,
    });
  }

  // ===== MASA YERLEŞİMİ - Merit Royal Diamond Ballroom Referansı =====
  // Numaralandırma: Sol üstten başlayıp satır satır sağa doğru

  let tableNum = 1;

  // ----- BÖLGE 1: SAHNE YANLARI (Satır 1-2) -----
  // Sol taraf: 5 masa x 2 satır = 10 masa (1-10)
  // Sağ taraf: 5 masa x 2 satır = 10 masa (11-20)

  const stageLeftStartX = stageX - 5 * spacing - 10;
  const stageRightStartX = stageX + stageWidth + 10;

  // Sol taraf masaları (1-10)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 5; col++) {
      tables.push({
        id: `stage-left-${tableNum}`,
        tableNumber: tableNum,
        type: "unassigned",
        capacity: 12,
        x: stageLeftStartX + col * spacing,
        y: stageY + row * spacing,
        isLoca: false,
        isLocked: false,
      });
      tableNum++;
    }
  }

  // Sağ taraf masaları (11-20)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 5; col++) {
      tables.push({
        id: `stage-right-${tableNum}`,
        tableNumber: tableNum,
        type: "unassigned",
        capacity: 12,
        x: stageRightStartX + col * spacing,
        y: stageY + row * spacing,
        isLoca: false,
        isLocked: false,
      });
      tableNum++;
    }
  }

  // ----- BÖLGE 2: CATWALK-1 YANLARI (Satır 3-4) -----
  // Sol taraf: 7 masa x 2 satır = 14 masa (21-34)
  // Sağ taraf: 7 masa x 2 satır = 14 masa (35-48)

  const catwalk1LeftStartX = catwalk1X - 7 * spacing - 10;
  const catwalk1RightStartX = catwalk1X + catwalk1Width + 10;

  // Sol taraf (21-34)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 7; col++) {
      tables.push({
        id: `catwalk1-left-${tableNum}`,
        tableNumber: tableNum,
        type: "unassigned",
        capacity: 12,
        x: catwalk1LeftStartX + col * spacing,
        y: catwalk1Y + row * spacing,
        isLoca: false,
        isLocked: false,
      });
      tableNum++;
    }
  }

  // Sağ taraf (35-48)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 7; col++) {
      tables.push({
        id: `catwalk1-right-${tableNum}`,
        tableNumber: tableNum,
        type: "unassigned",
        capacity: 12,
        x: catwalk1RightStartX + col * spacing,
        y: catwalk1Y + row * spacing,
        isLoca: false,
        isLocked: false,
      });
      tableNum++;
    }
  }

  // ----- BÖLGE 3: CATWALK-2 YANLARI (Satır 5) -----
  // Sol taraf: 6 masa (49-54)
  // Sağ taraf: 6 masa (55-60)

  const catwalk2LeftStartX = catwalk2X - 6 * spacing - 10;
  const catwalk2RightStartX = catwalk2X + catwalk2Width + 10;

  // Sol taraf (49-54)
  for (let col = 0; col < 6; col++) {
    tables.push({
      id: `catwalk2-left-${tableNum}`,
      tableNumber: tableNum,
      type: "unassigned",
      capacity: 12,
      x: catwalk2LeftStartX + col * spacing,
      y: catwalk2Y,
      isLoca: false,
      isLocked: false,
    });
    tableNum++;
  }

  // Sağ taraf (55-60)
  for (let col = 0; col < 6; col++) {
    tables.push({
      id: `catwalk2-right-${tableNum}`,
      tableNumber: tableNum,
      type: "unassigned",
      capacity: 12,
      x: catwalk2RightStartX + col * spacing,
      y: catwalk2Y,
      isLoca: false,
      isLocked: false,
    });
    tableNum++;
  }

  // ----- BÖLGE 4: ARKA ALAN (Satır 6-10) -----
  // 15 masa genişliğinde, 5 satır

  const backStartY = catwalk2Y + catwalk2Height + 15;
  const backStartX = centerX - (15 * spacing) / 2;

  // Satır 6-9: 15'li tam satırlar (61-120)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 15; col++) {
      tables.push({
        id: `back-row${row}-${tableNum}`,
        tableNumber: tableNum,
        type: "unassigned",
        capacity: 12,
        x: backStartX + col * spacing,
        y: backStartY + row * spacing,
        isLoca: false,
        isLocked: false,
      });
      tableNum++;
    }
  }

  // ----- BÖLGE 5: SYSTEM KONTROL SATIRI (Satır 10) -----
  // Sol 6 masa + System Kontrol + Sağ 6 masa

  const row10Y = backStartY + 4 * spacing;
  const systemControlWidth = 3 * spacing;
  const systemControlHeight = spacing;
  const systemControlX = centerX - systemControlWidth / 2;

  // System Control
  stages.push({
    id: "system-control",
    type: "system_control",
    x: systemControlX,
    y: row10Y,
    width: systemControlWidth,
    height: systemControlHeight,
    label: "SYSTEM KONTROL",
    isLocked: false,
  });

  // Sol 6 masa (121-126)
  for (let col = 0; col < 6; col++) {
    tables.push({
      id: `back-row10-left-${tableNum}`,
      tableNumber: tableNum,
      type: "unassigned",
      capacity: 12,
      x: backStartX + col * spacing,
      y: row10Y,
      isLoca: false,
      isLocked: false,
    });
    tableNum++;
  }

  // Sağ 6 masa (127-132)
  for (let col = 0; col < 6; col++) {
    tables.push({
      id: `back-row10-right-${tableNum}`,
      tableNumber: tableNum,
      type: "unassigned",
      capacity: 12,
      x: backStartX + (9 + col) * spacing,
      y: row10Y,
      isLoca: false,
      isLocked: false,
    });
    tableNum++;
  }

  // ----- BÖLGE 6: LOCA ÖNÜ SATIRI (Satır 11) -----
  // Sol 3 masa + Boşluk + Sağ 3 masa

  const row11Y = backStartY + 5 * spacing;

  // Sol 3 masa (133-135)
  for (let col = 0; col < 3; col++) {
    tables.push({
      id: `back-row11-left-${tableNum}`,
      tableNumber: tableNum,
      type: "unassigned",
      capacity: 12,
      x: backStartX + col * spacing,
      y: row11Y,
      isLoca: false,
      isLocked: false,
    });
    tableNum++;
  }

  // Sağ 3 masa (136-138)
  for (let col = 0; col < 3; col++) {
    tables.push({
      id: `back-row11-right-${tableNum}`,
      tableNumber: tableNum,
      type: "unassigned",
      capacity: 12,
      x: backStartX + (12 + col) * spacing,
      y: row11Y,
      isLoca: false,
      isLocked: false,
    });
    tableNum++;
  }

  // ----- BÖLGE 7: KENAR MASALARI (Sol ve Sağ Duvar) -----
  // Merit Royal'deki gibi kenar masaları

  // Sol kenar masaları (139-142) - Dikey sıra
  const leftEdgeX = 15;
  const leftEdgeStartY = catwalk2Y;
  for (let i = 0; i < 4; i++) {
    tables.push({
      id: `left-edge-${tableNum}`,
      tableNumber: tableNum,
      type: "unassigned",
      capacity: 12,
      x: leftEdgeX,
      y: leftEdgeStartY + i * spacing,
      isLoca: false,
      isLocked: false,
    });
    tableNum++;
  }

  // Sağ kenar masaları (143-145) - Dikey sıra
  const rightEdgeX = CANVAS_WIDTH - 55;
  const rightEdgeStartY = catwalk2Y;
  for (let i = 0; i < 3; i++) {
    tables.push({
      id: `right-edge-${tableNum}`,
      tableNumber: tableNum,
      type: "unassigned",
      capacity: 12,
      x: rightEdgeX,
      y: rightEdgeStartY + i * spacing,
      isLoca: false,
      isLocked: false,
    });
    tableNum++;
  }

  // ----- BÖLGE 8: VIP MASALARI -----
  // VIP masaları (146-148) - Ortada özel konumda
  const vipY = row11Y;
  const vipStartX = centerX - 1.5 * spacing;

  for (let i = 0; i < 3; i++) {
    tables.push({
      id: `vip-${tableNum}`,
      tableNumber: tableNum,
      type: "vip",
      capacity: 12,
      x: vipStartX + i * spacing,
      y: vipY,
      isLoca: false,
      isLocked: false,
    });
    tableNum++;
  }

  // ----- BÖLGE 9: LOCALAR (12 adet) -----
  // Localar en altta, yan yana sıralı

  const locaY = row11Y + spacing + 15;
  const locaTotalWidth = CANVAS_WIDTH - 80;
  const locaSpacing = locaTotalWidth / 12;

  for (let i = 0; i < 12; i++) {
    tables.push({
      id: `loca-${i}`,
      tableNumber: 1000 + i,
      type: "loca",
      capacity: 6,
      x: 40 + i * locaSpacing,
      y: locaY,
      isLoca: true,
      locaName: LOCA_NAMES[i],
      isLocked: false,
    });
  }

  return { tables, stages };
};

// ==================== MAIN COMPONENT ====================
export default function VenuePlannerPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const eventId = params.id as string;
  const canvasRef = useRef<HTMLDivElement>(null);

  // Core state
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<PlanStep>("tables");

  // Step 1: Table Planning
  const [tablePlans, setTablePlans] = useState<TablePlan[]>([]);
  const [newTableType, setNewTableType] = useState<TableType>("standard");
  const [newTableCapacity, setNewTableCapacity] = useState(12);
  const [newTableCount, setNewTableCount] = useState(1);

  // Step 2: Stage Selection
  const [stageConfig, setStageConfig] = useState<StageConfig>("full");

  // Step 3: Layout Canvas
  const [placedTables, setPlacedTables] = useState<PlacedTable[]>([]);
  const [stageElements, setStageElements] = useState<StageElement[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1.0);
  const [gridSnap, setGridSnap] = useState(false); // Varsayılan kapalı
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [selectedAssignType, setSelectedAssignType] =
    useState<TableType>("vip");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawing state
  const [drawnLines, setDrawnLines] = useState<DrawnLine[]>([]);
  const [currentLine, setCurrentLine] = useState<DrawnLine | null>(null);
  const [drawColor, setDrawColor] = useState("#ef4444");
  const [drawWidth, setDrawWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);

  // Drag state
  const [draggedItem, setDraggedItem] = useState<{
    id: string;
    type: "table" | "stage";
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

  // Lasso selection state
  const [isLassoSelecting, setIsLassoSelecting] = useState(false);
  const [lassoStart, setLassoStart] = useState({ x: 0, y: 0 });
  const [lassoEnd, setLassoEnd] = useState({ x: 0, y: 0 });

  // Multi-drag state
  const [isMultiDragging, setIsMultiDragging] = useState(false);
  const [multiDragStart, setMultiDragStart] = useState({ x: 0, y: 0 });

  // Stage resize state
  const [resizingStage, setResizingStage] = useState<{
    id: string;
    edge: "right" | "bottom" | "corner";
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // History (Undo/Redo)
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetId: null,
    targetType: null,
  });

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editCapacity, setEditCapacity] = useState(12);

  // Template modals
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [loadTemplateModalOpen, setLoadTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templates, setTemplates] = useState<VenueTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Custom Table Types Modal
  const [tableTypeModalOpen, setTableTypeModalOpen] = useState(false);
  const [newTableTypeName, setNewTableTypeName] = useState("");
  const [newTableTypeColor, setNewTableTypeColor] = useState("#3b82f6");
  const [customTableTypes, setCustomTableTypes] = useState<
    { id: string; label: string; color: string }[]
  >([]);

  // Lasso ref
  const lassoJustFinishedRef = useRef(false);

  // ==================== HISTORY MANAGEMENT ====================
  const saveToHistory = useCallback(() => {
    const newState: HistoryState = {
      placedTables: JSON.parse(JSON.stringify(placedTables)),
      stageElements: JSON.parse(JSON.stringify(stageElements)),
      drawnLines: JSON.parse(JSON.stringify(drawnLines)),
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [placedTables, stageElements, drawnLines, history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setPlacedTables(prevState.placedTables);
      setStageElements(prevState.stageElements);
      setDrawnLines(prevState.drawnLines || []);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setPlacedTables(nextState.placedTables);
      setStageElements(nextState.stageElements);
      setDrawnLines(nextState.drawnLines || []);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // ==================== DATA FETCHING ====================
  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventRes = await eventsApi.getOne(eventId);
        setEvent(eventRes.data);

        if (eventRes.data?.venueLayout) {
          const layout = eventRes.data.venueLayout;
          if (layout.tablePlans) setTablePlans(layout.tablePlans);
          if (layout.stageConfig) setStageConfig(layout.stageConfig);
          if (layout.placedTables) setPlacedTables(layout.placedTables);
          if (layout.stageElements) setStageElements(layout.stageElements);
          if (
            layout.placedTables?.length > 0 ||
            layout.stageElements?.length > 0
          ) {
            setCurrentStep("layout");
          }
        }
      } catch (error) {
        toast.error("Etkinlik yüklenemedi");
        router.push("/events");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () =>
      setContextMenu((prev) => ({ ...prev, visible: false }));
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redo();
      }
      if (e.key === "Delete" && selectedItems.length > 0) {
        deleteSelectedItems();
      }
      if (e.key === " ") {
        e.preventDefault();
        setActiveTool("pan");
      }
      // 1, 2, 3 tuşları ile hızlı tip seçimi
      if (e.key === "1") setSelectedAssignType("vip");
      if (e.key === "2") setSelectedAssignType("premium");
      if (e.key === "3") setSelectedAssignType("standard");
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        setActiveTool("select");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedItems, historyIndex, history]);

  // ==================== HELPER FUNCTIONS ====================
  const snapToGrid = (value: number) => {
    if (!gridSnap) return value;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  // ==================== STEP 1: TABLE PLANNING ====================
  const addTablePlan = () => {
    if (newTableCount < 1 || newTableCapacity < 1) {
      toast.error("Geçerli değerler girin");
      return;
    }
    const newPlan: TablePlan = {
      id: `plan-${Date.now()}`,
      type: newTableType,
      capacity: newTableCapacity,
      count: newTableCount,
    };
    setTablePlans([...tablePlans, newPlan]);
    setNewTableCount(1);
    toast.success("Masa planı eklendi");
  };

  const removeTablePlan = (id: string) => {
    setTablePlans(tablePlans.filter((p) => p.id !== id));
  };

  const totalPlannedCapacity = tablePlans.reduce(
    (sum, p) => sum + p.capacity * p.count,
    0
  );
  const totalPlannedTables = tablePlans.reduce((sum, p) => sum + p.count, 0);

  // ==================== STEP 2 -> STEP 3: PROCEED TO LAYOUT ====================
  const proceedToLayout = () => {
    if (tablePlans.length === 0) {
      toast.error("En az bir masa planı ekleyin");
      return;
    }

    // Default layout oluştur
    const { tables, stages } = generateDefaultLayout(stageConfig);

    setPlacedTables(tables);
    setStageElements(stages);
    setDrawnLines([]);
    setHistory([
      { placedTables: tables, stageElements: stages, drawnLines: [] },
    ]);
    setHistoryIndex(0);
    setCurrentStep("layout");

    toast.success(
      "Varsayılan yerleşim yüklendi. Sol panelden masa tipi seçip masalara tıklayarak atama yapın."
    );
  };

  // ==================== TABLE ASSIGNMENT ====================
  const assignTableType = (tableId: string, type: TableType) => {
    setPlacedTables(
      placedTables.map((t) => (t.id === tableId ? { ...t, type } : t))
    );
    saveToHistory();
  };

  const assignSelectedTablesType = (type: TableType | string) => {
    if (selectedItems.length === 0) return;
    setPlacedTables(
      placedTables.map((t) =>
        selectedItems.includes(t.id) ? { ...t, type: type as TableType } : t
      )
    );
    saveToHistory();

    // Label'ı bul - varsayılan veya custom type olabilir
    const config = TABLE_TYPE_CONFIG[type as TableType];
    const customType = customTableTypes.find((ct) => ct.id === type);
    const label = config?.label || customType?.label || type;

    toast.success(`${selectedItems.length} masa ${label} olarak atandı`);
  };

  // ==================== TABLE OPERATIONS ====================
  const deleteSelectedItems = () => {
    setPlacedTables(placedTables.filter((t) => !selectedItems.includes(t.id)));
    setSelectedItems([]);
    saveToHistory();
  };

  const addNewTable = (x: number, y: number) => {
    const maxNumber = Math.max(
      ...placedTables.filter((t) => !t.isLoca).map((t) => t.tableNumber),
      0
    );
    const newTable: PlacedTable = {
      id: `table-new-${Date.now()}`,
      tableNumber: maxNumber + 1,
      type: "unassigned",
      capacity: 12,
      x: snapToGrid(x),
      y: snapToGrid(y),
      isLoca: false,
      isLocked: false,
    };
    setPlacedTables([...placedTables, newTable]);
    saveToHistory();
    toast.success("Yeni masa eklendi");
  };

  const changeSelectedCapacity = (capacity: number) => {
    if (selectedItems.length === 0 || capacity < 1) return;
    setPlacedTables(
      placedTables.map((t) =>
        selectedItems.includes(t.id) ? { ...t, capacity } : t
      )
    );
    saveToHistory();
    toast.success(
      `${selectedItems.length} masa kapasitesi ${capacity} olarak değiştirildi`
    );
  };

  // ==================== STATISTICS ====================
  const getAssignedCount = (type: TableType) => {
    return placedTables.filter((t) => t.type === type && !t.isLoca).length;
  };

  const getAssignedCapacity = (type: TableType) => {
    return placedTables
      .filter((t) => t.type === type)
      .reduce((sum, t) => sum + t.capacity, 0);
  };

  const getPlanRemaining = (planType: TableType) => {
    const planned = tablePlans
      .filter((p) => p.type === planType)
      .reduce((sum, p) => sum + p.count, 0);
    const assigned = getAssignedCount(planType);
    return planned - assigned;
  };

  const totalAssignedCapacity = placedTables
    .filter((t) => t.type !== "unassigned")
    .reduce((sum, t) => sum + t.capacity, 0);
  const totalLocaCapacity = placedTables
    .filter((t) => t.isLoca && t.type !== "unassigned")
    .reduce((sum, t) => sum + t.capacity, 0);

  // ==================== DRAG HANDLERS ====================
  const handleTableMouseDown = (e: React.MouseEvent, tableId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const table = placedTables.find((t) => t.id === tableId);
    if (!table || table.isLocked) return;

    // Assign tool aktifse, tıklanan masaya tip ata
    if (activeTool === "assign") {
      assignTableType(tableId, selectedAssignType);
      return;
    }

    // Multi-drag
    if (
      selectedItems.length > 1 &&
      selectedItems.includes(tableId) &&
      canvasRef.current
    ) {
      setIsMultiDragging(true);
      const canvasRect = canvasRef.current.getBoundingClientRect();
      setMultiDragStart({
        x: (e.clientX - canvasRect.left - canvasOffset.x) / zoom,
        y: (e.clientY - canvasRect.top - canvasOffset.y) / zoom,
      });
      return;
    }

    // Single drag
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDraggedItem({
      id: tableId,
      type: "table",
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });

    if (!e.shiftKey) {
      setSelectedItems([tableId]);
    } else if (!selectedItems.includes(tableId)) {
      setSelectedItems([...selectedItems, tableId]);
    }
  };

  // ==================== CANVAS MOUSE HANDLERS ====================
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool === "pan") {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - canvasOffset.x,
        y: e.clientY - canvasOffset.y,
      });
      return;
    }

    // Çizim aracı
    if (
      (activeTool === "draw" || activeTool === "eraser") &&
      canvasRef.current
    ) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - canvasRect.left - canvasOffset.x) / zoom;
      const y = (e.clientY - canvasRect.top - canvasOffset.y) / zoom;

      if (activeTool === "draw") {
        setIsDrawing(true);
        setCurrentLine({
          id: `line-${Date.now()}`,
          points: [{ x, y }],
          color: drawColor,
          width: drawWidth,
        });
      } else if (activeTool === "eraser") {
        const clickedLineIdx = drawnLines.findIndex((line) => {
          return line.points.some((point) => {
            const distance = Math.sqrt(
              Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)
            );
            return distance < 15;
          });
        });
        if (clickedLineIdx !== -1) {
          setDrawnLines(drawnLines.filter((_, idx) => idx !== clickedLineIdx));
          saveToHistory();
        }
      }
      return;
    }

    // Lasso selection
    if (
      (activeTool === "select" || activeTool === "assign") &&
      canvasRef.current
    ) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - canvasRect.left - canvasOffset.x) / zoom;
      const y = (e.clientY - canvasRect.top - canvasOffset.y) / zoom;

      setIsLassoSelecting(true);
      setLassoStart({ x, y });
      setLassoEnd({ x, y });
      if (!e.shiftKey) setSelectedItems([]);
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Pan
      if (isPanning) {
        setCanvasOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
        return;
      }

      // Çizim
      if (isDrawing && currentLine && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - canvasRect.left - canvasOffset.x) / zoom;
        const y = (e.clientY - canvasRect.top - canvasOffset.y) / zoom;
        setCurrentLine({
          ...currentLine,
          points: [...currentLine.points, { x, y }],
        });
        return;
      }

      // Lasso selection
      if (isLassoSelecting && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - canvasRect.left - canvasOffset.x) / zoom;
        const y = (e.clientY - canvasRect.top - canvasOffset.y) / zoom;
        setLassoEnd({ x, y });

        const minX = Math.min(lassoStart.x, x);
        const maxX = Math.max(lassoStart.x, x);
        const minY = Math.min(lassoStart.y, y);
        const maxY = Math.max(lassoStart.y, y);

        const selectedTableIds = placedTables
          .filter((t) => {
            const tableCenter = {
              x: t.x + TABLE_RADIUS,
              y: t.y + TABLE_RADIUS,
            };
            return (
              tableCenter.x >= minX &&
              tableCenter.x <= maxX &&
              tableCenter.y >= minY &&
              tableCenter.y <= maxY
            );
          })
          .map((t) => t.id);

        setSelectedItems(selectedTableIds);
        return;
      }

      // Multi-drag
      if (isMultiDragging && canvasRef.current && selectedItems.length > 1) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const currentX = (e.clientX - canvasRect.left - canvasOffset.x) / zoom;
        const currentY = (e.clientY - canvasRect.top - canvasOffset.y) / zoom;

        const deltaX = snapToGrid(currentX - multiDragStart.x);
        const deltaY = snapToGrid(currentY - multiDragStart.y);

        if (deltaX !== 0 || deltaY !== 0) {
          setPlacedTables((prev) =>
            prev.map((t) =>
              selectedItems.includes(t.id) && !t.isLocked
                ? {
                    ...t,
                    x: snapToGrid(t.x + deltaX),
                    y: snapToGrid(t.y + deltaY),
                  }
                : t
            )
          );
          setMultiDragStart({ x: currentX, y: currentY });
        }
        return;
      }

      // Stage resize
      if (resizingStage && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const currentX = (e.clientX - canvasRect.left - canvasOffset.x) / zoom;
        const currentY = (e.clientY - canvasRect.top - canvasOffset.y) / zoom;

        const deltaX = currentX - resizingStage.startX;
        const deltaY = currentY - resizingStage.startY;

        setStageElements((prev) =>
          prev.map((el) => {
            if (el.id !== resizingStage.id) return el;

            let newWidth = resizingStage.startWidth;
            let newHeight = resizingStage.startHeight;

            if (
              resizingStage.edge === "right" ||
              resizingStage.edge === "corner"
            ) {
              newWidth = Math.max(50, resizingStage.startWidth + deltaX);
            }
            if (
              resizingStage.edge === "bottom" ||
              resizingStage.edge === "corner"
            ) {
              newHeight = Math.max(20, resizingStage.startHeight + deltaY);
            }

            return { ...el, width: newWidth, height: newHeight };
          })
        );
        return;
      }

      // Single Drag
      if (!draggedItem || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const newX = snapToGrid(
        (e.clientX - canvasRect.left - draggedItem.offsetX - canvasOffset.x) /
          zoom
      );
      const newY = snapToGrid(
        (e.clientY - canvasRect.top - draggedItem.offsetY - canvasOffset.y) /
          zoom
      );

      const boundedX = Math.max(0, Math.min(newX, CANVAS_WIDTH - 60));
      const boundedY = Math.max(0, Math.min(newY, CANVAS_HEIGHT - 60));

      // Stage element drag
      if (draggedItem.type === "stage") {
        setStageElements((prev) =>
          prev.map((el) =>
            el.id === draggedItem.id ? { ...el, x: boundedX, y: boundedY } : el
          )
        );
        return;
      }

      // Table drag
      setPlacedTables((prev) =>
        prev.map((t) =>
          t.id === draggedItem.id && !t.isLocked
            ? { ...t, x: boundedX, y: boundedY }
            : t
        )
      );
    },
    [
      draggedItem,
      isPanning,
      isLassoSelecting,
      isMultiDragging,
      isDrawing,
      currentLine,
      zoom,
      gridSnap,
      canvasOffset,
      panStart,
      lassoStart,
      multiDragStart,
      placedTables,
      selectedItems,
      resizingStage,
    ]
  );

  const handleMouseUp = useCallback(() => {
    if (draggedItem || isMultiDragging || resizingStage) {
      saveToHistory();
    }

    if (isDrawing && currentLine && currentLine.points.length > 1) {
      setDrawnLines([...drawnLines, currentLine]);
      setCurrentLine(null);
      setIsDrawing(false);
      saveToHistory();
    } else {
      setCurrentLine(null);
      setIsDrawing(false);
    }

    setResizingStage(null);

    const hadLassoSelection = isLassoSelecting && selectedItems.length > 0;

    setDraggedItem(null);
    setIsPanning(false);
    setIsLassoSelecting(false);
    setIsMultiDragging(false);

    if (hadLassoSelection) {
      lassoJustFinishedRef.current = true;
      setTimeout(() => {
        lassoJustFinishedRef.current = false;
      }, 100);
    }
  }, [
    draggedItem,
    isMultiDragging,
    isLassoSelecting,
    isDrawing,
    currentLine,
    drawnLines,
    selectedItems,
    saveToHistory,
  ]);

  // ==================== CONTEXT MENU ====================
  const handleContextMenu = (
    e: React.MouseEvent,
    targetId: string | null,
    targetType: "table" | "stage" | "canvas"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Canvas'a sağ tık için koordinatları kaydet
    let canvasX = 0,
      canvasY = 0;
    if (targetType === "canvas" && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      canvasX = (e.clientX - canvasRect.left - canvasOffset.x) / zoom;
      canvasY = (e.clientY - canvasRect.top - canvasOffset.y) / zoom;
    }

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetId: targetType === "canvas" ? `${canvasX},${canvasY}` : targetId,
      targetType,
    });
  };

  // ==================== FULLSCREEN & CLEAR ====================
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  // Otomatik hizalama - seçili masaları en yakın grid noktasına snap eder (sahne/catwalk'a dokunmaz)
  const autoAlignTables = () => {
    const hasSelection = selectedItems.length > 0;

    const alignedTables = placedTables.map((table) => {
      // Seçim varsa sadece seçilileri, yoksa tümünü hizala
      if (hasSelection && !selectedItems.includes(table.id)) {
        return table;
      }
      return {
        ...table,
        x: Math.round(table.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(table.y / GRID_SIZE) * GRID_SIZE,
      };
    });

    setPlacedTables(alignedTables);
    // Sahne elementlerine dokunma

    saveToHistory();
    toast.success(
      hasSelection
        ? `${selectedItems.length} masa grid'e hizalandı`
        : "Tüm masalar grid'e hizalandı"
    );
  };

  const clearAllLines = () => {
    setDrawnLines([]);
    saveToHistory();
    toast.success("Tüm çizgiler silindi");
  };

  // ==================== SAVE ====================
  const saveLayout = async () => {
    setSaving(true);
    try {
      const layout = {
        tablePlans,
        stageConfig,
        placedTables,
        stageElements,
        drawnLines,
        dimensions: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      };
      await eventsApi.updateLayout(eventId, { venueLayout: layout });
      toast.success("Alan düzeni kaydedildi");
    } catch (error) {
      toast.error("Kaydetme başarısız");
    } finally {
      setSaving(false);
    }
  };

  // ==================== TEMPLATE FUNCTIONS ====================
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await venuesApi.getAll();
      setTemplates(res.data || []);
    } catch (error) {
      toast.error("Şablonlar yüklenemedi");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Şablon adı gerekli");
      return;
    }
    setSavingTemplate(true);
    try {
      const layoutData = {
        tablePlans,
        stageConfig,
        placedTables,
        stageElements,
        drawnLines,
        dimensions: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      };
      await venuesApi.create({
        name: templateName,
        description: templateDescription,
        layoutData,
        isPublic: false,
      });
      toast.success("Şablon kaydedildi");
      setSaveTemplateModalOpen(false);
      setTemplateName("");
      setTemplateDescription("");
    } catch (error) {
      toast.error("Şablon kaydedilemedi");
    } finally {
      setSavingTemplate(false);
    }
  };

  const loadTemplate = async (template: VenueTemplate) => {
    try {
      const layout = template.layoutData;
      if (layout.tablePlans) setTablePlans(layout.tablePlans);
      if (layout.stageConfig) setStageConfig(layout.stageConfig);
      if (layout.placedTables) setPlacedTables(layout.placedTables);
      if (layout.stageElements) setStageElements(layout.stageElements);
      if (layout.drawnLines) setDrawnLines(layout.drawnLines);

      // History'yi sıfırla
      setHistory([
        {
          placedTables: layout.placedTables || [],
          stageElements: layout.stageElements || [],
          drawnLines: layout.drawnLines || [],
        },
      ]);
      setHistoryIndex(0);

      // Kullanım sayısını artır
      await venuesApi.update(template.id, {
        usageCount: template.usageCount + 1,
      });

      toast.success(`"${template.name}" şablonu yüklendi`);
      setLoadTemplateModalOpen(false);
      setCurrentStep("layout");
    } catch (error) {
      toast.error("Şablon yüklenemedi");
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      await venuesApi.delete(templateId);
      setTemplates(templates.filter((t) => t.id !== templateId));
      toast.success("Şablon silindi");
    } catch (error) {
      toast.error("Şablon silinemedi");
    }
  };

  // ==================== RENDER ====================
  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64 bg-slate-700" />
          <Skeleton className="h-[600px] w-full bg-slate-700" />
        </div>
      </PageContainer>
    );
  }

  if (!event) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-slate-400">Etkinlik bulunamadı</p>
          <Button asChild className="mt-4">
            <Link href="/events">Etkinliklere Dön</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-6">
            <h1 className="text-base font-semibold text-white">{event.name}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(event.eventDate).toLocaleDateString("tr-TR")}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {new Date(event.eventDate).toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentStep === "layout" && (
              <>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  <Users className="w-4 h-4 mr-1" />
                  {totalAssignedCapacity} / {totalPlannedCapacity + 72}
                </Badge>
                <Button
                  onClick={() => {
                    fetchTemplates();
                    setLoadTemplateModalOpen(true);
                  }}
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Şablondan Yükle
                </Button>
                <Button
                  onClick={() => setSaveTemplateModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Şablon Kaydet
                </Button>
                <Button
                  onClick={saveLayout}
                  disabled={saving}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Kaydet
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2">
          {[
            { key: "tables", label: "Masa Planı", icon: Layout },
            { key: "stage", label: "Sahne Seçimi", icon: Theater },
            { key: "layout", label: "Alan Düzenleme", icon: Grid3X3 },
          ].map((step, idx) => (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => {
                  if (
                    step.key === "tables" ||
                    (step.key === "stage" && tablePlans.length > 0) ||
                    (step.key === "layout" && placedTables.length > 0)
                  ) {
                    setCurrentStep(step.key as PlanStep);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  currentStep === step.key
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                <step.icon className="w-4 h-4" />
                {step.label}
              </button>
              {idx < 2 && (
                <ChevronRight className="w-5 h-5 text-slate-600 mx-2" />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Tables */}
        {currentStep === "tables" && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Masa Planı Ekle
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-400">Masa Tipi</Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={newTableType}
                        onValueChange={(v) => setNewTableType(v as TableType)}
                      >
                        <SelectTrigger className="bg-slate-900 border-slate-700 flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {(
                            [
                              "vip",
                              "premium",
                              "standard",
                              "loca",
                            ] as TableType[]
                          ).map((type) => {
                            const config = TABLE_TYPE_CONFIG[type];
                            return (
                              <SelectItem key={type} value={type}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: config.color }}
                                  />
                                  {config.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                          {/* Custom table types */}
                          {customTableTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: type.color }}
                                />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 border-dashed border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/10"
                        onClick={() => setTableTypeModalOpen(true)}
                        title="Yeni Masa Tipi Ekle"
                      >
                        <Plus className="w-4 h-4 text-emerald-500" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400">
                      Kişi Sayısı (Masa Başı)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={newTableCapacity}
                      onChange={(e) =>
                        setNewTableCapacity(Number(e.target.value))
                      }
                      className="bg-slate-900 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400">Masa Adedi</Label>
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={newTableCount}
                      onChange={(e) => setNewTableCount(Number(e.target.value))}
                      className="bg-slate-900 border-slate-700"
                    />
                  </div>
                  <Button
                    onClick={addTablePlan}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Plana Ekle
                  </Button>
                </CardContent>
              </Card>
            </div>
            <div className="col-span-8">
              <Card className="bg-slate-800 border-slate-700 h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Layout className="w-5 h-5" />
                      Etkinlik Masa Planı
                    </CardTitle>
                    <div className="flex items-center gap-4">
                      <Badge className="bg-slate-700 text-slate-300">
                        {totalPlannedTables} Masa
                      </Badge>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        <Users className="w-4 h-4 mr-1" />
                        {totalPlannedCapacity} Kişi
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {tablePlans.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Layout className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Henüz masa planı eklenmedi</p>
                      <p className="text-sm mt-1">Sol panelden masa ekleyin</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tablePlans.map((plan) => {
                        const config = TABLE_TYPE_CONFIG[plan.type];
                        return (
                          <div
                            key={plan.id}
                            className="flex items-center justify-between p-4 rounded-lg border"
                            style={{
                              backgroundColor: `${config.color}15`,
                              borderColor: `${config.color}40`,
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className="w-12 h-12 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: config.color }}
                              >
                                <config.icon className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <p className="font-medium text-white">
                                  {config.label}
                                </p>
                                <p className="text-sm text-slate-400">
                                  {plan.capacity} kişilik × {plan.count} adet
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <Badge
                                className="text-white"
                                style={{ backgroundColor: config.color }}
                              >
                                {plan.capacity * plan.count} Kişi
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => removeTablePlan(plan.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {tablePlans.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
                      <Button
                        onClick={() => setCurrentStep("stage")}
                        className="bg-gradient-to-r from-emerald-500 to-teal-500"
                      >
                        Devam Et
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2: Stage */}
        {currentStep === "stage" && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Theater className="w-5 h-5" />
                Sahne Konfigürasyonu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
                {[
                  {
                    key: "full",
                    label: "Sahne + Catwalk 1 + Catwalk 2",
                    desc: "Tam konfigürasyon",
                  },
                  {
                    key: "no_catwalk2",
                    label: "Sahne + Catwalk 1",
                    desc: "Catwalk 2 yok",
                  },
                  {
                    key: "no_catwalks",
                    label: "Sadece Sahne",
                    desc: "Catwalk yok",
                  },
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setStageConfig(option.key as StageConfig)}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      stageConfig === option.key
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-slate-700 hover:border-slate-600 bg-slate-900"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-full h-32 bg-slate-800 rounded-lg relative overflow-hidden p-2">
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-6 bg-purple-600 rounded text-[8px] text-white flex items-center justify-center">
                          SAHNE
                        </div>
                        {(option.key === "full" ||
                          option.key === "no_catwalk2") && (
                          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-3 h-12 bg-purple-500 rounded" />
                        )}
                        {option.key === "full" && (
                          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-12 h-3 bg-purple-400 rounded" />
                        )}
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-white text-sm">
                          {option.label}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {option.desc}
                        </p>
                      </div>
                      {stageConfig === option.key && (
                        <Badge className="bg-purple-500 text-white">
                          <Check className="w-3 h-3 mr-1" />
                          Seçili
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-8 pt-4 border-t border-slate-700 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep("tables")}
                  className="border-slate-600"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Geri
                </Button>
                <Button
                  onClick={proceedToLayout}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500"
                >
                  Devam Et
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Layout */}
        {currentStep === "layout" && (
          <div
            className={`space-y-2 ${
              isFullscreen
                ? "fixed inset-0 z-50 bg-slate-900 p-4 overflow-auto"
                : ""
            }`}
          >
            {/* Shortcuts Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span>🖱️ Tıkla: Masa ata</span>
                <span>⇧ Shift+Tık: Çoklu seçim</span>
                <span>␣ Space: Kaydır</span>
                <span>⌨️ 1/2/3: VIP/Premium/Standart</span>
                <span>🗑️ Delete: Sil</span>
              </div>
              <div className="flex items-center gap-2">
                {(
                  ["vip", "premium", "standard", "unassigned"] as TableType[]
                ).map((type) => {
                  const config = TABLE_TYPE_CONFIG[type];
                  return (
                    <div key={type} className="flex items-center gap-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                      <span>{config.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Toolbar */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Tools */}
                <Button
                  variant={activeTool === "select" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool("select")}
                  className={activeTool === "select" ? "bg-blue-600" : ""}
                  title="Seçim Aracı"
                >
                  <MousePointer2 className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTool === "assign" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool("assign")}
                  className={activeTool === "assign" ? "bg-green-600" : ""}
                  title="Masa Atama Aracı"
                >
                  <Circle className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTool === "pan" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool("pan")}
                  className={activeTool === "pan" ? "bg-blue-600" : ""}
                  title="Kaydırma (Space)"
                >
                  <Hand className="w-4 h-4" />
                </Button>

                <div className="w-px h-6 bg-slate-700 mx-2" />

                {/* Drawing */}
                <Button
                  variant={activeTool === "draw" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool("draw")}
                  className={activeTool === "draw" ? "bg-orange-600" : ""}
                  title="Çizgi Çiz"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTool === "eraser" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool("eraser")}
                  className={activeTool === "eraser" ? "bg-pink-600" : ""}
                  title="Silgi"
                >
                  <Eraser className="w-4 h-4" />
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      title="Çizgi Rengi"
                    >
                      <div
                        className="w-4 h-4 rounded border border-slate-500"
                        style={{ backgroundColor: drawColor }}
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 bg-slate-800 border-slate-700">
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        "#ef4444",
                        "#f97316",
                        "#eab308",
                        "#22c55e",
                        "#3b82f6",
                        "#8b5cf6",
                        "#ec4899",
                        "#ffffff",
                        "#94a3b8",
                        "#000000",
                      ].map((color) => (
                        <button
                          key={color}
                          className={`w-6 h-6 rounded border-2 ${
                            drawColor === color
                              ? "border-white"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setDrawColor(color)}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {drawnLines.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllLines}
                    className="text-slate-400 hover:text-red-400"
                    title="Çizgileri Sil"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}

                <div className="w-px h-6 bg-slate-700 mx-2" />

                {/* Undo/Redo */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  title="Geri Al"
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  title="İleri Al"
                >
                  <Redo2 className="w-4 h-4" />
                </Button>

                <div className="w-px h-6 bg-slate-700 mx-2" />

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deleteSelectedItems}
                  disabled={selectedItems.length === 0}
                  className="text-red-400 hover:text-red-300"
                  title="Seçilileri Sil"
                >
                  <Trash2 className="w-4 h-4" />
                  {selectedItems.length > 0 && (
                    <span className="ml-1 text-xs">
                      ({selectedItems.length})
                    </span>
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-1">
                {/* Stats */}
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 mr-2">
                  {placedTables.filter((t) => t.type !== "unassigned").length} /{" "}
                  {placedTables.length} Atandı
                </Badge>

                <div className="w-px h-6 bg-slate-700 mx-2" />

                {/* Grid & Hizalama */}
                <Button
                  variant={gridSnap ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGridSnap(!gridSnap)}
                  className={gridSnap ? "bg-purple-600" : ""}
                  title="Grid Snap"
                >
                  <Magnet className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={autoAlignTables}
                  className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                  title="Otomatik Hizala"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>

                <div className="w-px h-6 bg-slate-700 mx-2" />

                {/* Zoom */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
                  title="Uzaklaştır"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-400 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                  title="Yakınlaştır"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setZoom(1.0);
                    setCanvasOffset({ x: 0, y: 0 });
                  }}
                  title="Sıfırla"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>

                <div className="w-px h-6 bg-slate-700 mx-2" />

                {/* Fullscreen */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  className={isFullscreen ? "text-yellow-400" : ""}
                  title="Tam Ekran"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Main Layout */}
            <div
              className={`grid gap-4 ${
                isFullscreen ? "grid-cols-1" : "grid-cols-12"
              }`}
            >
              {/* Left Panel - Assignment (fullscreen'de gizle) */}
              {!isFullscreen && (
                <div className="col-span-2 space-y-3">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-white">
                        Masa Tipi Seç
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(
                        ["vip", "premium", "standard", "loca"] as TableType[]
                      ).map((type) => {
                        const config = TABLE_TYPE_CONFIG[type];
                        const planned = tablePlans
                          .filter((p) => p.type === type)
                          .reduce((sum, p) => sum + p.count, 0);
                        const assigned = getAssignedCount(type);
                        const remaining = planned - assigned;

                        return (
                          <button
                            key={type}
                            onClick={() => {
                              setSelectedAssignType(type);
                              setActiveTool("assign");
                            }}
                            className={`w-full p-3 rounded-lg border-2 transition-all ${
                              selectedAssignType === type &&
                              activeTool === "assign"
                                ? "border-white bg-opacity-30"
                                : "border-transparent hover:border-slate-600"
                            }`}
                            style={{ backgroundColor: `${config.color}20` }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: config.color }}
                                >
                                  <config.icon className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-white font-medium">
                                  {config.label}
                                </span>
                              </div>
                              <Badge
                                className={
                                  remaining > 0
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-green-500/20 text-green-400"
                                }
                              >
                                {assigned}/{planned}
                              </Badge>
                            </div>
                          </button>
                        );
                      })}

                      {/* Custom Table Types */}
                      {customTableTypes.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => {
                            setSelectedAssignType(type.id as TableType);
                            setActiveTool("assign");
                          }}
                          className={`w-full p-3 rounded-lg border-2 transition-all ${
                            selectedAssignType === type.id &&
                            activeTool === "assign"
                              ? "border-white bg-opacity-30"
                              : "border-transparent hover:border-slate-600"
                          }`}
                          style={{ backgroundColor: `${type.color}20` }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: type.color }}
                              >
                                <Circle className="w-4 h-4 text-white" />
                              </div>
                              <span className="text-white font-medium">
                                {type.label}
                              </span>
                            </div>
                            <Badge className="bg-slate-500/20 text-slate-400">
                              0/0
                            </Badge>
                          </div>
                        </button>
                      ))}

                      <div className="pt-2 border-t border-slate-700 text-xs text-slate-400">
                        <p>Tip seçip masalara tıklayın</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Selected Actions */}
                  {selectedItems.length > 0 && (
                    <Card className="bg-slate-800 border-slate-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-white">
                          {selectedItems.length} Masa Seçili
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {(
                          ["vip", "premium", "standard", "loca"] as TableType[]
                        ).map((type) => {
                          const config = TABLE_TYPE_CONFIG[type];
                          return (
                            <Button
                              key={type}
                              variant="outline"
                              size="sm"
                              className="w-full justify-start"
                              style={{
                                borderColor: config.color,
                                color: config.color,
                              }}
                              onClick={() => assignSelectedTablesType(type)}
                            >
                              <config.icon className="w-4 h-4 mr-2" />
                              {config.label} Yap
                            </Button>
                          );
                        })}
                        {/* Custom Table Types */}
                        {customTableTypes.map((type) => (
                          <Button
                            key={type.id}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                            style={{
                              borderColor: type.color,
                              color: type.color,
                            }}
                            onClick={() =>
                              assignSelectedTablesType(type.id as TableType)
                            }
                          >
                            <Circle className="w-4 h-4 mr-2" />
                            {type.label} Yap
                          </Button>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Stats */}
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="pt-3">
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Salon Masaları</span>
                          <span className="text-white">
                            {placedTables.filter((t) => !t.isLoca).length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Localar</span>
                          <span className="text-white">
                            {placedTables.filter((t) => t.isLoca).length}
                          </span>
                        </div>
                        <div className="border-t border-slate-700 pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">
                              Atanan Kapasite
                            </span>
                            <span className="text-emerald-400">
                              {totalAssignedCapacity}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Canvas */}
              <div className={isFullscreen ? "col-span-1" : "col-span-10"}>
                <Card className="bg-slate-800 border-slate-700 overflow-hidden">
                  <div
                    ref={canvasRef}
                    className={`relative bg-slate-900 overflow-hidden ${
                      activeTool === "pan"
                        ? "cursor-grab"
                        : activeTool === "assign"
                        ? "cursor-pointer"
                        : "cursor-default"
                    } ${isPanning ? "cursor-grabbing" : ""}`}
                    style={{
                      width: "100%",
                      height: isFullscreen ? "calc(100vh - 120px)" : 580,
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onMouseDown={handleCanvasMouseDown}
                    onContextMenu={(e) => handleContextMenu(e, null, "canvas")}
                    onClick={() => {
                      if (lassoJustFinishedRef.current) return;
                      if (activeTool === "select" && !isLassoSelecting) {
                        setSelectedItems([]);
                      }
                    }}
                  >
                    {/* Grid */}
                    {gridSnap && (
                      <svg
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          width: CANVAS_WIDTH * zoom,
                          height: CANVAS_HEIGHT * zoom,
                          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`,
                        }}
                      >
                        <defs>
                          <pattern
                            id="grid"
                            width={GRID_SIZE * zoom}
                            height={GRID_SIZE * zoom}
                            patternUnits="userSpaceOnUse"
                          >
                            <path
                              d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${
                                GRID_SIZE * zoom
                              }`}
                              fill="none"
                              stroke="rgba(100,116,139,0.1)"
                              strokeWidth="1"
                            />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                      </svg>
                    )}

                    {/* Canvas Content */}
                    <div
                      style={{
                        transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
                        transformOrigin: "top left",
                        width: CANVAS_WIDTH,
                        height: CANVAS_HEIGHT,
                        position: "relative",
                      }}
                    >
                      {/* Drawn Lines */}
                      <svg
                        className="absolute inset-0 pointer-events-none"
                        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
                      >
                        {drawnLines.map((line) => (
                          <polyline
                            key={line.id}
                            points={line.points
                              .map((p) => `${p.x},${p.y}`)
                              .join(" ")}
                            fill="none"
                            stroke={line.color}
                            strokeWidth={line.width}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ))}
                        {currentLine && (
                          <polyline
                            points={currentLine.points
                              .map((p) => `${p.x},${p.y}`)
                              .join(" ")}
                            fill="none"
                            stroke={currentLine.color}
                            strokeWidth={currentLine.width}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                      </svg>

                      {/* Stage Elements */}
                      {stageElements.map((element) => (
                        <div
                          key={element.id}
                          className="absolute select-none group"
                          style={{
                            left: element.x,
                            top: element.y,
                            width: element.width,
                            height: element.height,
                            cursor:
                              element.type !== "system_control" &&
                              !element.isLocked
                                ? "move"
                                : "default",
                          }}
                          onMouseDown={(e) => {
                            // System control ve kilitli elementler hariç sürüklenebilir
                            if (
                              element.type === "system_control" ||
                              element.isLocked
                            )
                              return;
                            e.stopPropagation();
                            const rect = (
                              e.currentTarget as HTMLElement
                            ).getBoundingClientRect();
                            setDraggedItem({
                              id: element.id,
                              type: "stage",
                              offsetX: e.clientX - rect.left,
                              offsetY: e.clientY - rect.top,
                            });
                          }}
                          onContextMenu={(e) =>
                            handleContextMenu(e, element.id, "stage")
                          }
                        >
                          <div
                            className={`w-full h-full rounded-lg flex items-center justify-center relative ${
                              element.type === "stage"
                                ? "bg-blue-600"
                                : element.type === "system_control"
                                ? "bg-amber-600"
                                : "bg-purple-500"
                            } ${
                              element.isLocked ? "ring-2 ring-amber-400" : ""
                            }`}
                          >
                            <div className="text-center text-white">
                              <span className="text-xs font-medium">
                                {element.label}
                              </span>
                            </div>
                          </div>
                          {/* Resize Handles - sahne ve catwalk'lar için (kilitli değilse) */}
                          {(element.type === "stage" ||
                            element.type === "catwalk1" ||
                            element.type === "catwalk2") &&
                            !element.isLocked && (
                              <>
                                {/* Sağ kenar */}
                                <div
                                  className="absolute top-0 right-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (!canvasRef.current) return;
                                    const canvasRect =
                                      canvasRef.current.getBoundingClientRect();
                                    setResizingStage({
                                      id: element.id,
                                      edge: "right",
                                      startX:
                                        (e.clientX -
                                          canvasRect.left -
                                          canvasOffset.x) /
                                        zoom,
                                      startY:
                                        (e.clientY -
                                          canvasRect.top -
                                          canvasOffset.y) /
                                        zoom,
                                      startWidth: element.width,
                                      startHeight: element.height,
                                    });
                                  }}
                                />
                                {/* Alt kenar */}
                                <div
                                  className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 bg-white/30"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (!canvasRef.current) return;
                                    const canvasRect =
                                      canvasRef.current.getBoundingClientRect();
                                    setResizingStage({
                                      id: element.id,
                                      edge: "bottom",
                                      startX:
                                        (e.clientX -
                                          canvasRect.left -
                                          canvasOffset.x) /
                                        zoom,
                                      startY:
                                        (e.clientY -
                                          canvasRect.top -
                                          canvasOffset.y) /
                                        zoom,
                                      startWidth: element.width,
                                      startHeight: element.height,
                                    });
                                  }}
                                />
                                {/* Köşe */}
                                <div
                                  className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize opacity-0 group-hover:opacity-100 bg-white/50 rounded-tl"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (!canvasRef.current) return;
                                    const canvasRect =
                                      canvasRef.current.getBoundingClientRect();
                                    setResizingStage({
                                      id: element.id,
                                      edge: "corner",
                                      startX:
                                        (e.clientX -
                                          canvasRect.left -
                                          canvasOffset.x) /
                                        zoom,
                                      startY:
                                        (e.clientY -
                                          canvasRect.top -
                                          canvasOffset.y) /
                                        zoom,
                                      startWidth: element.width,
                                      startHeight: element.height,
                                    });
                                  }}
                                />
                              </>
                            )}
                        </div>
                      ))}

                      {/* Tables */}
                      {placedTables
                        .filter((t) => !t.isLoca)
                        .map((table) => {
                          // Varsayılan veya custom type rengi
                          const defaultConfig =
                            TABLE_TYPE_CONFIG[table.type as TableType];
                          const customType = customTableTypes.find(
                            (ct) => ct.id === table.type
                          );
                          const color =
                            defaultConfig?.color ||
                            customType?.color ||
                            "#6b7280";
                          const borderColor =
                            defaultConfig?.borderColor ||
                            (customType ? `${customType.color}80` : "#9ca3af");
                          const isSelected = selectedItems.includes(table.id);

                          return (
                            <div
                              key={table.id}
                              className={`absolute select-none transition-transform ${
                                isSelected
                                  ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-10"
                                  : ""
                              }`}
                              style={{
                                left: table.x,
                                top: table.y,
                                cursor:
                                  activeTool === "assign"
                                    ? "pointer"
                                    : activeTool === "select"
                                    ? "move"
                                    : "default",
                              }}
                              onMouseDown={(e) =>
                                handleTableMouseDown(e, table.id)
                              }
                              onContextMenu={(e) =>
                                handleContextMenu(e, table.id, "table")
                              }
                            >
                              <div
                                className="w-8 h-8 rounded-full flex flex-col items-center justify-center text-white shadow-lg border-2"
                                style={{
                                  backgroundColor: color,
                                  borderColor: borderColor,
                                }}
                              >
                                <span className="text-[8px] font-bold">
                                  {table.tableNumber}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                      {/* Locas */}
                      {placedTables
                        .filter((t) => t.isLoca)
                        .map((loca) => {
                          // Varsayılan veya custom type rengi
                          const defaultConfig =
                            TABLE_TYPE_CONFIG[loca.type as TableType];
                          const customType = customTableTypes.find(
                            (ct) => ct.id === loca.type
                          );
                          const color =
                            defaultConfig?.color ||
                            customType?.color ||
                            "#6b7280";
                          const borderColor =
                            defaultConfig?.borderColor ||
                            (customType ? `${customType.color}80` : "#9ca3af");
                          const isSelected = selectedItems.includes(loca.id);

                          return (
                            <div
                              key={loca.id}
                              className={`absolute select-none ${
                                isSelected ? "ring-2 ring-white z-10" : ""
                              }`}
                              style={{
                                left: loca.x,
                                top: loca.y,
                                cursor:
                                  activeTool === "assign" ? "pointer" : "move",
                              }}
                              onMouseDown={(e) =>
                                handleTableMouseDown(e, loca.id)
                              }
                              onContextMenu={(e) =>
                                handleContextMenu(e, loca.id, "table")
                              }
                            >
                              <div
                                className="w-13 h-8 rounded-lg flex flex-col items-center justify-center text-white shadow-lg border"
                                style={{
                                  backgroundColor: color,
                                  borderColor: borderColor,
                                }}
                              >
                                <Sofa className="w-3 h-3" />
                                <span className="text-[8px] font-bold">
                                  {loca.locaName}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                      {/* Lasso Selection */}
                      {isLassoSelecting && (
                        <div
                          className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-50"
                          style={{
                            left: Math.min(lassoStart.x, lassoEnd.x),
                            top: Math.min(lassoStart.y, lassoEnd.y),
                            width: Math.abs(lassoEnd.x - lassoStart.x),
                            height: Math.abs(lassoEnd.y - lassoStart.y),
                          }}
                        />
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu.visible && (
          <div
            className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.targetType === "canvas" && (
              <button
                className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                onClick={() => {
                  const [x, y] = (contextMenu.targetId || "0,0")
                    .split(",")
                    .map(Number);
                  addNewTable(x, y);
                  setContextMenu({ ...contextMenu, visible: false });
                }}
              >
                <Plus className="w-4 h-4" />
                Masa Ekle
              </button>
            )}

            {contextMenu.targetType === "table" && (
              <>
                <div className="px-3 py-1.5 text-xs text-slate-500 font-medium">
                  Masa Tipi
                </div>
                {(["vip", "premium", "standard", "loca"] as TableType[]).map(
                  (type) => {
                    const config = TABLE_TYPE_CONFIG[type];
                    return (
                      <button
                        key={type}
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                          if (contextMenu.targetId) {
                            const ids =
                              selectedItems.length > 0 &&
                              selectedItems.includes(contextMenu.targetId)
                                ? selectedItems
                                : [contextMenu.targetId];
                            setPlacedTables(
                              placedTables.map((t) =>
                                ids.includes(t.id) ? { ...t, type } : t
                              )
                            );
                            saveToHistory();
                          }
                          setContextMenu({ ...contextMenu, visible: false });
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: config.color }}
                        />
                        {config.label}
                      </button>
                    );
                  }
                )}
                {/* Custom Table Types in Context Menu */}
                {customTableTypes.map((type) => (
                  <button
                    key={type.id}
                    className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    onClick={() => {
                      if (contextMenu.targetId) {
                        const ids =
                          selectedItems.length > 0 &&
                          selectedItems.includes(contextMenu.targetId)
                            ? selectedItems
                            : [contextMenu.targetId];
                        setPlacedTables(
                          placedTables.map((t) =>
                            ids.includes(t.id)
                              ? { ...t, type: type.id as TableType }
                              : t
                          )
                        );
                        saveToHistory();
                      }
                      setContextMenu({ ...contextMenu, visible: false });
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                    {type.label}
                  </button>
                ))}

                <div className="border-t border-slate-700 my-1" />

                {/* Kişi Sayısı - Submenu */}
                <div className="relative group">
                  <button className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      Kişi Sayısı
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                  {/* Submenu - sağa veya sola açılır */}
                  <div className="absolute left-full top-0 ml-1 hidden group-hover:block bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[120px]">
                    {[6, 8, 10, 12, 14, 16].map((cap) => (
                      <button
                        key={cap}
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                          if (contextMenu.targetId) {
                            const ids =
                              selectedItems.length > 0 &&
                              selectedItems.includes(contextMenu.targetId)
                                ? selectedItems
                                : [contextMenu.targetId];
                            setPlacedTables(
                              placedTables.map((t) =>
                                ids.includes(t.id) ? { ...t, capacity: cap } : t
                              )
                            );
                            saveToHistory();
                          }
                          setContextMenu({ ...contextMenu, visible: false });
                        }}
                      >
                        <Users className="w-3 h-3 text-slate-400" />
                        {cap} Kişilik
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-700 my-1" />

                {/* Sabitleme */}
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    if (contextMenu.targetId) {
                      const ids =
                        selectedItems.length > 0 &&
                        selectedItems.includes(contextMenu.targetId)
                          ? selectedItems
                          : [contextMenu.targetId];
                      const targetTable = placedTables.find(
                        (t) => t.id === contextMenu.targetId
                      );
                      const newLockState = !targetTable?.isLocked;
                      setPlacedTables(
                        placedTables.map((t) =>
                          ids.includes(t.id)
                            ? { ...t, isLocked: newLockState }
                            : t
                        )
                      );
                      saveToHistory();
                    }
                    setContextMenu({ ...contextMenu, visible: false });
                  }}
                >
                  {placedTables.find((t) => t.id === contextMenu.targetId)
                    ?.isLocked ? (
                    <>
                      <Unlock className="w-4 h-4 text-green-400" />
                      Sabitlemeyi Kaldır
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-amber-400" />
                      Sabitle
                    </>
                  )}
                </button>

                <div className="border-t border-slate-700 my-1" />

                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    const ids =
                      selectedItems.length > 0 &&
                      selectedItems.includes(contextMenu.targetId!)
                        ? selectedItems
                        : [contextMenu.targetId!];
                    setPlacedTables(
                      placedTables.filter((t) => !ids.includes(t.id))
                    );
                    setSelectedItems([]);
                    setContextMenu({ ...contextMenu, visible: false });
                    saveToHistory();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Sil
                </button>
              </>
            )}

            {/* Stage/Catwalk Context Menu */}
            {contextMenu.targetType === "stage" && (
              <>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    if (contextMenu.targetId) {
                      const targetElement = stageElements.find(
                        (el) => el.id === contextMenu.targetId
                      );
                      const newLockState = !targetElement?.isLocked;
                      setStageElements(
                        stageElements.map((el) =>
                          el.id === contextMenu.targetId
                            ? { ...el, isLocked: newLockState }
                            : el
                        )
                      );
                      saveToHistory();
                    }
                    setContextMenu({ ...contextMenu, visible: false });
                  }}
                >
                  {stageElements.find((el) => el.id === contextMenu.targetId)
                    ?.isLocked ? (
                    <>
                      <Unlock className="w-4 h-4 text-green-400" />
                      Sabitlemeyi Kaldır
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-amber-400" />
                      Sabitle
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* Save Template Modal */}
        <Dialog
          open={saveTemplateModalOpen}
          onOpenChange={setSaveTemplateModalOpen}
        >
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                Şablon Olarak Kaydet
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Mevcut yerleşimi şablon olarak kaydedin. Daha sonra başka
                etkinliklerde kullanabilirsiniz.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="templateName" className="text-slate-300">
                  Şablon Adı
                </Label>
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Örn: Merit Royal Diamond"
                  className="bg-slate-900 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateDesc" className="text-slate-300">
                  Açıklama (Opsiyonel)
                </Label>
                <Input
                  id="templateDesc"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Şablon hakkında kısa açıklama"
                  className="bg-slate-900 border-slate-600 text-white"
                />
              </div>
              <div className="bg-slate-900 rounded-lg p-3 text-sm text-slate-400">
                <p>Bu şablon şunları içerecek:</p>
                <ul className="mt-2 space-y-1">
                  <li>• {placedTables.filter((t) => !t.isLoca).length} masa</li>
                  <li>• {placedTables.filter((t) => t.isLoca).length} loca</li>
                  <li>• {stageElements.length} sahne/catwalk elementi</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSaveTemplateModalOpen(false)}
                className="border-slate-600 text-slate-300"
              >
                İptal
              </Button>
              <Button
                onClick={saveAsTemplate}
                disabled={savingTemplate || !templateName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {savingTemplate ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Load Template Modal */}
        <Dialog
          open={loadTemplateModalOpen}
          onOpenChange={setLoadTemplateModalOpen}
        >
          <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Şablondan Yükle</DialogTitle>
              <DialogDescription className="text-slate-400">
                Kayıtlı şablonlardan birini seçerek yerleşimi yükleyin.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Henüz kayıtlı şablon yok</p>
                  <p className="text-sm mt-1">
                    Mevcut yerleşimi "Şablon Kaydet" ile kaydedebilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-slate-900 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="text-white font-medium">
                          {template.name}
                        </h4>
                        {template.description && (
                          <p className="text-sm text-slate-400 mt-1">
                            {template.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span>
                            {new Date(template.createdAt).toLocaleDateString(
                              "tr-TR"
                            )}
                          </span>
                          <span>{template.usageCount} kez kullanıldı</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteTemplate(template.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => loadTemplate(template)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Yükle
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setLoadTemplateModalOpen(false)}
                className="border-slate-600 text-slate-300"
              >
                Kapat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Table Type Management Modal */}
        <Dialog open={tableTypeModalOpen} onOpenChange={setTableTypeModalOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">
                Masa Tiplerini Yönet
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Yeni masa tipi ekleyin veya mevcut tipleri düzenleyin.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Yeni Masa Tipi Ekleme */}
              <div className="space-y-3 p-3 bg-slate-900 rounded-lg">
                <Label className="text-slate-300 text-sm font-medium">
                  Yeni Masa Tipi Ekle
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newTableTypeName}
                    onChange={(e) => setNewTableTypeName(e.target.value)}
                    placeholder="Masa tipi adı"
                    className="bg-slate-800 border-slate-700 text-white flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-10 h-10 p-0 border-slate-700"
                        style={{ backgroundColor: newTableTypeColor }}
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2 bg-slate-800 border-slate-700">
                      <div className="grid grid-cols-6 gap-1">
                        {[
                          "#ef4444",
                          "#f97316",
                          "#f59e0b",
                          "#eab308",
                          "#84cc16",
                          "#22c55e",
                          "#10b981",
                          "#14b8a6",
                          "#06b6d4",
                          "#0ea5e9",
                          "#3b82f6",
                          "#6366f1",
                          "#8b5cf6",
                          "#a855f7",
                          "#d946ef",
                          "#ec4899",
                          "#f43f5e",
                          "#64748b",
                        ].map((color) => (
                          <button
                            key={color}
                            className={`w-6 h-6 rounded border-2 ${
                              newTableTypeColor === color
                                ? "border-white"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewTableTypeColor(color)}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newTableTypeName.trim()) {
                        setCustomTableTypes([
                          ...customTableTypes,
                          {
                            id: `custom-${Date.now()}`,
                            label: newTableTypeName.trim(),
                            color: newTableTypeColor,
                          },
                        ]);
                        setNewTableTypeName("");
                        setNewTableTypeColor("#3b82f6");
                      }
                    }}
                    disabled={!newTableTypeName.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Mevcut Masa Tipleri Listesi */}
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm font-medium">
                  Mevcut Masa Tipleri
                </Label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {/* Varsayılan tipler */}
                  {(["vip", "premium", "standard", "loca"] as TableType[]).map(
                    (type) => {
                      const config = TABLE_TYPE_CONFIG[type];
                      return (
                        <div
                          key={type}
                          className="flex items-center justify-between p-2 bg-slate-900 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: config.color }}
                            />
                            <span className="text-sm text-white">
                              {config.label}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-xs text-slate-500 border-slate-600"
                          >
                            Varsayılan
                          </Badge>
                        </div>
                      );
                    }
                  )}
                  {/* Özel tipler */}
                  {customTableTypes.map((type) => (
                    <div
                      key={type.id}
                      className="flex items-center justify-between p-2 bg-slate-900 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        <span className="text-sm text-white">{type.label}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() =>
                          setCustomTableTypes(
                            customTableTypes.filter((t) => t.id !== type.id)
                          )
                        }
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setTableTypeModalOpen(false)}
                className="border-slate-600 text-slate-300"
              >
                Kapat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
