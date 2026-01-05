"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, FileDown, FileUp, Box } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-notification";
import { eventsApi, venuesApi } from "@/lib/api";

import type {
  VenueEvent,
  DragState,
  ResizingState,
  PlacedTable,
} from "./types";
import {
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HEADER_SIZE,
  COLUMN_LETTERS,
  TABLE_TYPE_CONFIG,
  pixelToGrid,
  DEFAULT_TABLE_SIZE,
} from "./constants";
import { useVenueState, useVenueHistory } from "./hooks";
import {
  StageElementRenderer,
  EditModal,
  CanvasContextMenu,
  StageContextMenu,
  TableContextMenu,
  VenueToolbar,
  AddElementWizard,
  TableResizeModal,
  SpacingModal,
  Venue3DView,
} from "./components";

export default function VenuePlannerPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const eventId = params.id as string;

  // Data state
  const [event, setEvent] = useState<VenueEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Venue state hook - eventId ile taslak desteği
  const venue = useVenueState(eventId);

  // Draft recovery state
  const [showDraftDialog, setShowDraftDialog] = useState(false);

  // Template modal states
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [isPublicTemplate, setIsPublicTemplate] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [show3DView, setShow3DView] = useState(false);

  // History hook
  const history = useVenueHistory(
    venue.placedTables,
    venue.stageElements,
    venue.setPlacedTables,
    venue.setStageElements
  );

  // Drag & Resize state
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [resizing, setResizing] = useState<ResizingState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Fetch event data
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data } = await eventsApi.getOne(eventId);
        setEvent(data);

        // Taslak kontrolü
        const draftInfo = venue.checkDraft();

        if (data.venueLayout) {
          // Eğer taslak varsa ve sunucudaki veriden daha yeni ise, kullanıcıya sor
          if (draftInfo.hasDraft && draftInfo.savedAt) {
            setShowDraftDialog(true);
          } else {
            venue.setPlacedTables(data.venueLayout.placedTables || []);
            venue.setStageElements(data.venueLayout.stageElements || []);
            history.initHistory(
              data.venueLayout.placedTables || [],
              data.venueLayout.stageElements || []
            );
          }
        } else if (draftInfo.hasDraft) {
          // Sunucuda veri yok ama taslak var
          setShowDraftDialog(true);
        }
      } catch (error: any) {
        if (error?.response?.status === 401) {
          toast.error("Oturum süresi doldu, lütfen tekrar giriş yapın");
          router.push("/login");
          return;
        }
        toast.error("Etkinlik yüklenemedi");
        router.push("/events");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Save layout
  const saveLayout = async () => {
    setSaving(true);
    try {
      await eventsApi.updateLayout(eventId, {
        venueLayout: {
          placedTables: venue.placedTables,
          stageElements: venue.stageElements,
          dimensions: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
        },
      });
      toast.success("Yerleşim kaydedildi");
    } catch (error: any) {
      if (error?.response?.status === 401) {
        toast.error("Oturum süresi doldu, lütfen tekrar giriş yapın");
        router.push("/login");
        return;
      }
      toast.error("Kaydetme başarısız");
    } finally {
      setSaving(false);
    }
  };

  // ==================== ŞABLON FONKSİYONLARI (API) ====================
  // Şablonları API'den yükle
  const loadTemplatesFromApi = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const response = await venuesApi.getAll();
      setSavedTemplates(response.data || []);
    } catch (e) {
      console.error("Şablon yükleme hatası:", e);
      toast.error("Şablonlar yüklenemedi");
    } finally {
      setLoadingTemplates(false);
    }
  }, [toast]);

  // Şablon olarak kaydet (API)
  const saveAsTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      toast.error("Şablon adı gerekli");
      return;
    }

    setSavingTemplate(true);
    try {
      const templateData = {
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        isPublic: isPublicTemplate,
        layoutData: {
          placedTables: venue.placedTables,
          stageElements: venue.stageElements,
          dimensions: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
        },
      };

      await venuesApi.create(templateData);
      setShowSaveTemplateModal(false);
      setTemplateName("");
      setTemplateDescription("");
      setIsPublicTemplate(false);
      toast.success(`"${templateData.name}" şablonu kaydedildi`);
    } catch (e: any) {
      console.error("Şablon kaydetme hatası:", e);
      toast.error(e?.response?.data?.message || "Şablon kaydedilemedi");
    } finally {
      setSavingTemplate(false);
    }
  }, [
    templateName,
    templateDescription,
    isPublicTemplate,
    venue.placedTables,
    venue.stageElements,
    toast,
  ]);

  // Şablon yükle (API)
  const loadTemplate = useCallback(
    async (template: any) => {
      history.saveToHistory();

      // layoutData içinden placedTables ve stageElements al
      const layoutData = template.layoutData || {};
      venue.setPlacedTables(layoutData.placedTables || []);
      venue.setStageElements(layoutData.stageElements || []);

      // Kullanım sayısını artır
      try {
        await venuesApi.incrementUsage(template.id);
      } catch (e) {
        // Sessizce geç
      }

      setShowLoadTemplateModal(false);
      toast.success(`"${template.name}" şablonu yüklendi`);
    },
    [history, venue, toast]
  );

  // Şablon sil (API)
  const deleteTemplate = useCallback(
    async (templateId: string, tName: string) => {
      try {
        await venuesApi.delete(templateId);
        setSavedTemplates((prev) => prev.filter((t) => t.id !== templateId));
        toast.success(`"${tName}" şablonu silindi`);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || "Şablon silinemedi");
      }
    },
    [toast]
  );

  // Şablon modal açıldığında şablonları yükle
  useEffect(() => {
    if (showLoadTemplateModal) {
      loadTemplatesFromApi();
    }
  }, [showLoadTemplateModal, loadTemplatesFromApi]);

  // Canvas mouse position helper
  const getCanvasPosition = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0, col: "A", row: 1 };
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / venue.zoom;
      const y = (e.clientY - rect.top) / venue.zoom;
      const { col, row } = pixelToGrid(x, y);
      return { x, y, col, row };
    },
    [venue.zoom]
  );

  // Context menu handler
  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const { x, y, col, row } = getCanvasPosition(e);
      venue.setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        canvasX: x,
        canvasY: y,
        gridCol: col,
        gridRow: row,
        targetId: null,
        targetType: "canvas",
      });
    },
    [getCanvasPosition, venue]
  );

  // Context menu actions
  const handleContextMenuAction = useCallback(
    (type: "stage" | "area" | "table" | "loca") => {
      const { canvasX, canvasY, gridCol, gridRow } = venue.contextMenu;
      history.saveToHistory();

      if (type === "stage") {
        venue.addStage(canvasX, canvasY, gridCol, gridRow);
        venue.closeContextMenu();
      } else if (type === "area") {
        venue.addArea(canvasX, canvasY, gridCol, gridRow);
        venue.closeContextMenu();
      } else if (type === "table" || type === "loca") {
        // Masa ve loca için wizard aç
        venue.openAddWizard(type, canvasX, canvasY, gridCol, gridRow);
        venue.closeContextMenu();
      }
    },
    [venue, history]
  );

  // Stage mouse handlers
  const handleStageMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.button !== 0 || venue.activeTool !== "select") return;
      e.stopPropagation();
      const stage = venue.stageElements.find((s) => s.id === id);
      if (!stage || stage.isLocked) return;

      const { x, y } = getCanvasPosition(e);
      history.saveToHistory();
      setDragging({
        id,
        type: "stage",
        offsetX: x - stage.x,
        offsetY: y - stage.y,
      });

      if (!e.shiftKey) venue.setSelectedItems([id]);
      else
        venue.setSelectedItems((prev) =>
          prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    },
    [venue, getCanvasPosition, history]
  );

  const handleStageContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      venue.setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        canvasX: 0,
        canvasY: 0,
        gridCol: "A",
        gridRow: 1,
        targetId: id,
        targetType: "stage",
      });
    },
    [venue]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, id: string, edge: ResizingState["edge"]) => {
      e.stopPropagation();
      const stage = venue.stageElements.find((s) => s.id === id);
      if (!stage || stage.isLocked) return;
      history.saveToHistory();
      setResizing({
        id,
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: stage.width,
        startHeight: stage.height,
        startPosX: stage.x,
        startPosY: stage.y,
      });
    },
    [venue.stageElements, history]
  );

  // Table mouse handlers
  const handleTableMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.button !== 0 || venue.activeTool !== "select") return;
      e.stopPropagation();
      const table = venue.placedTables.find((t) => t.id === id);
      if (!table || table.isLocked) return;

      const { x, y } = getCanvasPosition(e);
      history.saveToHistory();

      // Eğer tıklanan masa zaten seçili ise, çoklu taşıma için hazırlan
      const isAlreadySelected = venue.selectedItems.includes(id);

      // Taşınacak masaları belirle ve başlangıç pozisyonlarını kaydet
      const tablesToMove = isAlreadySelected ? venue.selectedItems : [id];
      const initialPositions = new Map<string, { x: number; y: number }>();
      venue.placedTables.forEach((t) => {
        if (tablesToMove.includes(t.id)) {
          initialPositions.set(t.id, { x: t.x, y: t.y });
        }
      });

      setDragging({
        id,
        type: "table",
        offsetX: x - table.x,
        offsetY: y - table.y,
        initialPositions,
        tablesToMove, // Taşınacak masaları kaydet
      });

      // Ctrl+Click ile çoklu seçim toggle
      if (e.ctrlKey || e.metaKey) {
        venue.setSelectedItems((prev) =>
          prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
      } else if (e.shiftKey) {
        venue.setSelectedItems((prev) =>
          prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
      } else if (!isAlreadySelected) {
        // Seçili değilse sadece bu masayı seç
        venue.setSelectedItems([id]);
      }
      // Eğer zaten seçili ise, seçimi değiştirme (çoklu taşıma için)
    },
    [venue, getCanvasPosition, history]
  );

  const handleTableContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      venue.setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        canvasX: 0,
        canvasY: 0,
        gridCol: "A",
        gridRow: 1,
        targetId: id,
        targetType: "table",
      });
    },
    [venue]
  );

  // Canvas mouse move - Çoklu taşıma ve canvas sınırları
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = getCanvasPosition(e);

      // Lasso güncelle
      if (venue.lasso.isActive) {
        venue.updateLasso(x, y);
      }

      if (dragging) {
        let newX = x - dragging.offsetX;
        let newY = y - dragging.offsetY;

        if (venue.gridSnap) {
          newX = Math.round(newX / CELL_SIZE) * CELL_SIZE;
          newY = Math.round(newY / CELL_SIZE) * CELL_SIZE;
        }

        if (dragging.type === "stage") {
          // Canvas sınırları için clamp
          const stage = venue.stageElements.find((s) => s.id === dragging.id);
          if (stage) {
            newX = Math.max(0, Math.min(newX, CANVAS_WIDTH - stage.width));
            newY = Math.max(0, Math.min(newY, CANVAS_HEIGHT - stage.height));
          }
          venue.setStageElements((prev) =>
            prev.map((s) =>
              s.id === dragging.id ? { ...s, x: newX, y: newY } : s
            )
          );
        } else {
          // Masa taşıma - çoklu seçim desteği + collision detection
          const draggedTable = venue.placedTables.find(
            (t) => t.id === dragging.id
          );
          if (!draggedTable) return;

          // Sürüklenen masanın başlangıç pozisyonunu al
          const draggedInitialPos = dragging.initialPositions?.get(dragging.id);
          const draggedStartX = draggedInitialPos?.x ?? draggedTable.x;
          const draggedStartY = draggedInitialPos?.y ?? draggedTable.y;

          // Delta = yeni pozisyon - başlangıç pozisyonu
          // newX/newY zaten mouse pozisyonundan offset çıkarılmış hali
          const deltaX = newX - draggedStartX;
          const deltaY = newY - draggedStartY;

          // Taşınacak masaları dragging state'inden al (seçim değişse bile sabit)
          const tablesToMove = dragging.tablesToMove || [dragging.id];

          // Engeller: Stage elementleri (sahne, alan)
          const stageObstacles = venue.stageElements.map((s) => ({
            id: s.id,
            x: s.x,
            y: s.y,
            width: s.width,
            height: s.height,
          }));

          // Çakışma kontrolü - AABB collision
          const hasCollision = (
            tableId: string,
            tx: number,
            ty: number,
            tSize: number,
            allTables: typeof venue.placedTables
          ): boolean => {
            const padding = 2;

            // Stage elementleri ile çakışma
            for (const obs of stageObstacles) {
              if (
                tx < obs.x + obs.width + padding &&
                tx + tSize + padding > obs.x &&
                ty < obs.y + obs.height + padding &&
                ty + tSize + padding > obs.y
              ) {
                return true;
              }
            }

            // Diğer masalar ile çakışma (taşınan masalar hariç)
            for (const other of allTables) {
              if (other.id === tableId || tablesToMove.includes(other.id))
                continue;
              const otherSize = other.size || DEFAULT_TABLE_SIZE;
              if (
                tx < other.x + otherSize + padding &&
                tx + tSize + padding > other.x &&
                ty < other.y + otherSize + padding &&
                ty + tSize + padding > other.y
              ) {
                return true;
              }
            }

            return false;
          };

          venue.setPlacedTables((prev) => {
            // Önce tüm yeni pozisyonları hesapla - başlangıç pozisyonlarını kullan
            const proposedPositions = new Map<
              string,
              { x: number; y: number; oldX: number; oldY: number }
            >();

            for (const t of prev) {
              if (!tablesToMove.includes(t.id) || t.isLocked) continue;

              const tSize = t.size || DEFAULT_TABLE_SIZE;

              // Başlangıç pozisyonundan delta uygula
              const initPos = dragging.initialPositions?.get(t.id);
              const baseX = initPos?.x ?? t.x;
              const baseY = initPos?.y ?? t.y;

              let tNewX = baseX + deltaX;
              let tNewY = baseY + deltaY;

              // Canvas sınırları
              tNewX = Math.max(0, Math.min(tNewX, CANVAS_WIDTH - tSize));
              tNewY = Math.max(0, Math.min(tNewY, CANVAS_HEIGHT - tSize));

              proposedPositions.set(t.id, {
                x: tNewX,
                y: tNewY,
                oldX: t.x,
                oldY: t.y,
              });
            }

            // Çakışma kontrolü - herhangi bir masa çakışıyorsa TÜM masaları eski pozisyonlarında tut
            let anyCollision = false;
            for (const t of prev) {
              if (!tablesToMove.includes(t.id) || t.isLocked) continue;

              const proposed = proposedPositions.get(t.id);
              if (!proposed) continue;

              const tSize = t.size || DEFAULT_TABLE_SIZE;
              if (hasCollision(t.id, proposed.x, proposed.y, tSize, prev)) {
                anyCollision = true;
                break;
              }
            }

            // Çakışma varsa hiçbir masayı hareket ettirme
            if (anyCollision) {
              return prev;
            }

            // Çakışma yoksa tüm masaları yeni pozisyonlara taşı
            return prev.map((t) => {
              const proposed = proposedPositions.get(t.id);
              if (proposed) {
                return { ...t, x: proposed.x, y: proposed.y };
              }
              return t;
            });
          });
        }
      }

      if (resizing) {
        const dx = (e.clientX - resizing.startX) / venue.zoom;
        const dy = (e.clientY - resizing.startY) / venue.zoom;

        venue.setStageElements((prev) =>
          prev.map((s) => {
            if (s.id !== resizing.id) return s;
            let { x, y, width, height } = s;

            if (resizing.edge === "right" || resizing.edge === "corner") {
              width = Math.max(CELL_SIZE, resizing.startWidth + dx);
            }
            if (resizing.edge === "bottom" || resizing.edge === "corner") {
              height = Math.max(CELL_SIZE, resizing.startHeight + dy);
            }
            if (resizing.edge === "left") {
              const newWidth = Math.max(CELL_SIZE, resizing.startWidth - dx);
              x = resizing.startPosX + (resizing.startWidth - newWidth);
              width = newWidth;
            }
            if (resizing.edge === "top") {
              const newHeight = Math.max(CELL_SIZE, resizing.startHeight - dy);
              y = resizing.startPosY + (resizing.startHeight - newHeight);
              height = newHeight;
            }

            if (venue.gridSnap) {
              width = Math.round(width / CELL_SIZE) * CELL_SIZE;
              height = Math.round(height / CELL_SIZE) * CELL_SIZE;
              x = Math.round(x / CELL_SIZE) * CELL_SIZE;
              y = Math.round(y / CELL_SIZE) * CELL_SIZE;
            }

            return { ...s, x, y, width, height };
          })
        );
      }

      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        venue.setCanvasOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    },
    [dragging, resizing, isPanning, panStart, venue, getCanvasPosition]
  );

  const handleCanvasMouseUp = useCallback(() => {
    // Lasso seçimini tamamla
    if (venue.lasso.isActive) {
      venue.endLasso();
    }
    setDragging(null);
    setResizing(null);
    setIsPanning(false);
  }, [venue]);

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0 && venue.activeTool === "pan") {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
      } else if (
        e.button === 0 &&
        (venue.activeTool === "select" || venue.activeTool === "lasso")
      ) {
        // Lasso seçimi başlat (select veya lasso tool'da)
        const { x, y } = getCanvasPosition(e);
        venue.startLasso(x, y);
        venue.setSelectedItems([]);
      }
      venue.closeContextMenu();
    },
    [venue, getCanvasPosition]
  );

  // Keyboard shortcuts - Ok tuşları ile hareket eklendi
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "v") venue.setActiveTool("select");
      if (e.key === "h") venue.setActiveTool("pan");
      if (e.key === "l") venue.setActiveTool("lasso");

      // Ok tuşları ile seçili elementleri hareket ettir (masa, loca, sahne, alan)
      const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (arrowKeys.includes(e.key) && venue.selectedItems.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? CELL_SIZE : venue.gridSnap ? CELL_SIZE : 5;
        let dx = 0,
          dy = 0;

        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;

        history.saveToHistory();

        // Masaları (masa + loca) hareket ettir
        venue.setPlacedTables((prev) =>
          prev.map((t) => {
            if (!venue.selectedItems.includes(t.id) || t.isLocked) return t;
            const size = t.size || DEFAULT_TABLE_SIZE;
            // Canvas sınırları
            const newX = Math.max(0, Math.min(t.x + dx, CANVAS_WIDTH - size));
            const newY = Math.max(0, Math.min(t.y + dy, CANVAS_HEIGHT - size));
            return { ...t, x: newX, y: newY };
          })
        );

        // Stage elementlerini (sahne, alan) hareket ettir
        venue.setStageElements((prev) =>
          prev.map((s) => {
            if (!venue.selectedItems.includes(s.id) || s.isLocked) return s;
            // Canvas sınırları
            const newX = Math.max(
              0,
              Math.min(s.x + dx, CANVAS_WIDTH - s.width)
            );
            const newY = Math.max(
              0,
              Math.min(s.y + dy, CANVAS_HEIGHT - s.height)
            );
            return { ...s, x: newX, y: newY };
          })
        );
      }

      if (e.key === "Delete" && venue.selectedItems.length > 0) {
        history.saveToHistory();
        venue.selectedItems.forEach((id) => {
          if (venue.stageElements.find((s) => s.id === id))
            venue.deleteStageElement(id);
          else if (venue.placedTables.find((t) => t.id === id))
            venue.deleteTable(id);
        });
        venue.setSelectedItems([]);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        history.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        history.redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveLayout();
      }
      // Ctrl+A ile tüm elementleri seç (masalar + sahne/alan)
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        const allIds = [
          ...venue.placedTables.map((t) => t.id),
          ...venue.stageElements.map((s) => s.id),
        ];
        venue.setSelectedItems(allIds);
      }
      // Escape ile seçimi temizle
      if (e.key === "Escape") {
        venue.setSelectedItems([]);
        venue.cancelLasso();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [venue, history, saveLayout]);

  // Auto-align tables - Collision detection ile akıllı hizalama
  // Masalar üst üste binmez, boyutlarına göre yan yana dizilir
  // SABİT (isLocked) masalar hareket etmez
  const autoAlignTables = useCallback(() => {
    history.saveToHistory();

    const tableIdsToAlign =
      venue.selectedItems.length > 0
        ? venue.selectedItems
        : venue.placedTables.map((t) => t.id);

    // Masaları tableNumber'a göre sırala - SABİT MASALARI HARİÇ TUT
    const sortedTables = [...venue.placedTables]
      .filter((t) => tableIdsToAlign.includes(t.id) && !t.isLocked)
      .sort((a, b) => a.tableNumber - b.tableNumber);

    // Hizalanmayacak masalar (sabit kalacaklar + seçili olmayanlar)
    const fixedTables = venue.placedTables.filter(
      (t) => !tableIdsToAlign.includes(t.id) || t.isLocked
    );

    // Stage elementleri de engel olarak say
    const obstacles = [
      ...venue.stageElements.map((s) => ({
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
      })),
      ...fixedTables.map((t) => {
        const size = t.size || DEFAULT_TABLE_SIZE;
        return { x: t.x, y: t.y, width: size, height: size };
      }),
    ];

    // Collision check helper
    const hasCollision = (
      x: number,
      y: number,
      size: number,
      placedPositions: Array<{ x: number; y: number; size: number }>
    ) => {
      const padding = 4; // Masalar arası minimum boşluk
      // Engeller ile çakışma
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
      // Daha önce yerleştirilmiş masalar ile çakışma
      for (const placed of placedPositions) {
        if (
          x < placed.x + placed.size + padding &&
          x + size + padding > placed.x &&
          y < placed.y + placed.size + padding &&
          y + size + padding > placed.y
        ) {
          return true;
        }
      }
      return false;
    };

    // Yeni pozisyonları hesapla
    const alignedPositions = new Map<string, { x: number; y: number }>();
    const placedPositions: Array<{ x: number; y: number; size: number }> = [];

    // Tüm masalar veya hiç seçili değilse 1. satırdan başla (y=0)
    // Sadece bazı masalar seçiliyse mevcut pozisyonlarına yakın yerleştir
    const isFullAlign =
      venue.selectedItems.length === 0 ||
      venue.selectedItems.length === venue.placedTables.length;

    // A ve Z sütunları boş kalacak - B sütunundan başla (1 * CELL_SIZE)
    // Y sütununda bitir - masa boyutunu da hesaba kat
    const MIN_X = CELL_SIZE; // B sütunu başlangıcı (40px)
    const MAX_X = CANVAS_WIDTH - CELL_SIZE; // Z sütunu öncesi (1000px) - masa boyutu ayrıca kontrol edilecek

    // İlk satır başlangıç noktası - 1. satır = y: 0, x: B sütunu
    let currentX = MIN_X;
    let currentY = 0;
    let rowMaxHeight = 0;

    sortedTables.forEach((table) => {
      const size = table.size || DEFAULT_TABLE_SIZE;

      // Mevcut pozisyona yakın bir yer bul (collision yoksa)
      let bestX = currentX;
      let bestY = currentY;

      // Satır sonuna geldiyse (Y sütununu geçtiyse) yeni satıra geç
      if (bestX + size > MAX_X) {
        bestX = MIN_X;
        bestY = currentY + rowMaxHeight + 4; // Satırlar arası boşluk
        rowMaxHeight = 0;
      }

      // Collision varsa boş yer ara
      let attempts = 0;
      while (
        hasCollision(bestX, bestY, size, placedPositions) &&
        attempts < 500
      ) {
        bestX += size + 4; // Masa boyutu + boşluk kadar ilerle
        if (bestX + size > MAX_X) {
          bestX = MIN_X;
          bestY += CELL_SIZE;
        }
        if (bestY + size > CANVAS_HEIGHT) {
          // Canvas doldu, en son pozisyonda bırak
          break;
        }
        attempts++;
      }

      // Son collision kontrolü - eğer hala çakışma varsa, masayı yerleştirme
      if (hasCollision(bestX, bestY, size, placedPositions)) {
        // Çakışma devam ediyorsa, masayı mevcut pozisyonunda bırak
        alignedPositions.set(table.id, { x: table.x, y: table.y });
        placedPositions.push({ x: table.x, y: table.y, size });
        toast.warning(`Masa ${table.tableNumber} için uygun yer bulunamadı`);
      } else {
        alignedPositions.set(table.id, { x: bestX, y: bestY });
        placedPositions.push({ x: bestX, y: bestY, size });
      }

      // Sonraki masa için pozisyonu güncelle
      currentX = bestX + size + 4; // Masalar arası boşluk
      currentY = bestY;
      rowMaxHeight = Math.max(rowMaxHeight, size);
    });

    venue.setPlacedTables((prev) =>
      prev.map((t) => {
        const newPos = alignedPositions.get(t.id);
        if (newPos) {
          return { ...t, x: newPos.x, y: newPos.y };
        }
        return t;
      })
    );

    const count = tableIdsToAlign.length;
    toast.success(
      venue.selectedItems.length > 0
        ? `${count} seçili masa hizalandı (sabit masalar korundu)`
        : `Tüm masalar hizalandı (${count}, sabitler hariç)`
    );
  }, [history, venue, toast]);

  // Zoom handlers
  const handleZoomIn = () => venue.setZoom((z) => Math.min(z + 0.1, 2));
  const handleZoomOut = () => venue.setZoom((z) => Math.max(z - 0.1, 0.5));
  const handleResetView = () => {
    venue.setZoom(1);
    venue.setCanvasOffset({ x: 0, y: 0 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-screen bg-slate-900 ${
        venue.isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Geri
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">{event?.name}</h1>
            <p className="text-sm text-slate-400">Mekan Yerleşimi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">
            Zoom: {Math.round(venue.zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShow3DView(true)}
            disabled={
              venue.placedTables.length === 0 &&
              venue.stageElements.length === 0
            }
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
            title="3D Görünüm"
          >
            <Box className="w-4 h-4 mr-2" />
            3D
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLoadTemplateModal(true)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <FileUp className="w-4 h-4 mr-2" />
            Şablon Yükle
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveTemplateModal(true)}
            disabled={
              venue.placedTables.length === 0 &&
              venue.stageElements.length === 0
            }
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Şablon Kaydet
          </Button>
          <Button
            onClick={saveLayout}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Kaydet
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 overflow-y-auto">
          <VenueToolbar
            activeTool={venue.activeTool}
            setActiveTool={venue.setActiveTool}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={history.undo}
            onRedo={history.redo}
            zoom={venue.zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetView={handleResetView}
            isFullscreen={venue.isFullscreen}
            onToggleFullscreen={() =>
              venue.setIsFullscreen(!venue.isFullscreen)
            }
            gridSnap={venue.gridSnap}
            onToggleGridSnap={() => venue.setGridSnap(!venue.gridSnap)}
            showGuideLines={venue.showGuideLines}
            onToggleGuideLines={() =>
              venue.setShowGuideLines(!venue.showGuideLines)
            }
            onAutoAlign={autoAlignTables}
            selectedAssignType={venue.selectedAssignType}
            setSelectedAssignType={venue.setSelectedAssignType}
            selectedItems={venue.selectedItems}
            onAssignSelectedType={venue.assignSelectedTablesType}
            tableStats={venue.tableStats}
            placedTables={venue.placedTables}
            onLockSelected={venue.lockSelectedItems}
            onUnlockSelected={venue.unlockSelectedItems}
            onDeleteSelected={venue.deleteSelectedItems}
            onSpacingSelected={() => venue.openSpacing(venue.selectedItems)}
          />
        </div>

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-950 p-4"
        >
          <div
            style={{
              transform: `scale(${venue.zoom}) translate(${venue.canvasOffset.x}px, ${venue.canvasOffset.y}px)`,
              transformOrigin: "top left",
            }}
          >
            {/* Column Headers */}
            <div className="flex" style={{ marginLeft: HEADER_SIZE }}>
              {COLUMN_LETTERS.map((letter) => (
                <div
                  key={letter}
                  className="flex items-center justify-center text-xs text-slate-500 font-medium"
                  style={{ width: CELL_SIZE, height: HEADER_SIZE }}
                >
                  {letter}
                </div>
              ))}
            </div>

            <div className="flex">
              {/* Row Headers */}
              <div className="flex flex-col">
                {Array.from({ length: GRID_ROWS }, (_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center text-xs text-slate-500 font-medium"
                    style={{ width: HEADER_SIZE, height: CELL_SIZE }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Canvas */}
              <div
                ref={canvasRef}
                className="relative bg-slate-900 border border-slate-700 rounded-lg overflow-hidden"
                style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onContextMenu={handleCanvasContextMenu}
              >
                {/* Grid */}
                {venue.showGuideLines && (
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                  >
                    {Array.from({ length: GRID_COLS + 1 }, (_, i) => (
                      <line
                        key={`v${i}`}
                        x1={i * CELL_SIZE}
                        y1={0}
                        x2={i * CELL_SIZE}
                        y2={CANVAS_HEIGHT}
                        stroke="#334155"
                        strokeWidth="1"
                      />
                    ))}
                    {Array.from({ length: GRID_ROWS + 1 }, (_, i) => (
                      <line
                        key={`h${i}`}
                        x1={0}
                        y1={i * CELL_SIZE}
                        x2={CANVAS_WIDTH}
                        y2={i * CELL_SIZE}
                        stroke="#334155"
                        strokeWidth="1"
                      />
                    ))}
                  </svg>
                )}

                {/* Stage Elements */}
                {venue.stageElements.map((stage) => (
                  <StageElementRenderer
                    key={stage.id}
                    stage={stage}
                    isSelected={venue.selectedItemsSet.has(stage.id)}
                    activeTool={venue.activeTool}
                    onMouseDown={handleStageMouseDown}
                    onContextMenu={handleStageContextMenu}
                    onDoubleClick={venue.openAreaEditModal}
                    onResizeMouseDown={handleResizeMouseDown}
                  />
                ))}

                {/* Tables */}
                {venue.placedTables.map((table) => (
                  <TableRenderer
                    key={table.id}
                    table={table}
                    isSelected={venue.selectedItemsSet.has(table.id)}
                    activeTool={venue.activeTool}
                    onMouseDown={handleTableMouseDown}
                    onContextMenu={handleTableContextMenu}
                  />
                ))}

                {/* Lasso Selection Rectangle */}
                {venue.lasso.isActive && (
                  <div
                    className="absolute border-2 border-dashed border-blue-400 bg-blue-400/10 pointer-events-none"
                    style={{
                      left: Math.min(venue.lasso.startX, venue.lasso.currentX),
                      top: Math.min(venue.lasso.startY, venue.lasso.currentY),
                      width: Math.abs(
                        venue.lasso.currentX - venue.lasso.startX
                      ),
                      height: Math.abs(
                        venue.lasso.currentY - venue.lasso.startY
                      ),
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Menus */}
      <CanvasContextMenu
        contextMenu={venue.contextMenu}
        onAction={handleContextMenuAction}
        onClose={venue.closeContextMenu}
      />
      <StageContextMenu
        contextMenu={venue.contextMenu}
        stageElements={venue.stageElements}
        onCenterHorizontally={venue.centerStageHorizontally}
        onEdit={venue.openAreaEditModal}
        onToggleLock={venue.toggleStageLock}
        onDelete={venue.deleteStageElement}
        onClose={venue.closeContextMenu}
      />
      <TableContextMenu
        contextMenu={venue.contextMenu}
        placedTables={venue.placedTables}
        selectedItems={venue.selectedItems}
        onAssignType={venue.assignTableType}
        onToggleLock={venue.toggleTableLock}
        onDelete={venue.deleteTable}
        onResize={venue.openTableResize}
        onApplySizeToSameType={venue.applySizeToSameTypeTables}
        onSpacing={venue.openSpacing}
        onEditLocaName={venue.openLocaNameEdit}
        onClose={venue.closeContextMenu}
      />

      {/* Edit Modal */}
      <EditModal
        areaEdit={venue.areaEdit}
        setAreaEdit={venue.setAreaEdit}
        stageElements={venue.stageElements}
        onSave={venue.saveAreaEdit}
      />

      {/* Table Resize Modal */}
      <TableResizeModal
        resizeState={venue.tableResize}
        onSizeChange={(size) =>
          venue.setTableResize((prev) => ({ ...prev, currentSize: size }))
        }
        onApply={venue.applyTableResize}
        onClose={venue.closeTableResize}
      />

      {/* Spacing Modal */}
      <SpacingModal
        spacingState={venue.spacing}
        onSpacingChange={(spacing) =>
          venue.setSpacing((prev) => ({ ...prev, currentSpacing: spacing }))
        }
        onApply={venue.applySpacing}
        onClose={venue.closeSpacing}
      />

      {/* Loca Name Edit Modal */}
      {venue.locaNameEdit.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-sm w-full mx-4 border border-slate-700 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              Loca İsmi Düzenle
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Loca İsmi
                </label>
                <input
                  type="text"
                  value={venue.locaNameEdit.locaName}
                  onChange={(e) =>
                    venue.setLocaNameEdit((prev) => ({
                      ...prev,
                      locaName: e.target.value,
                    }))
                  }
                  placeholder="Örn: VIP Loca 1, Balkon A..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") venue.saveLocaName();
                    if (e.key === "Escape") venue.closeLocaNameEdit();
                  }}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <Button
                variant="outline"
                onClick={venue.closeLocaNameEdit}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                İptal
              </Button>
              <Button
                onClick={venue.saveLocaName}
                disabled={!venue.locaNameEdit.locaName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Element Wizard */}
      <AddElementWizard
        wizard={venue.addWizard}
        setWizard={venue.setAddWizard}
        onNext={venue.nextWizardStep}
        onPrev={venue.prevWizardStep}
        onSubmit={venue.addBulkElements}
        onClose={venue.closeAddWizard}
      />

      {/* Click outside to close context menu */}
      {venue.contextMenu.visible && (
        <div className="fixed inset-0 z-40" onClick={venue.closeContextMenu} />
      )}

      {/* Draft Recovery Dialog */}
      {showDraftDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md mx-4 border border-slate-700 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">
              Kaydedilmemiş Taslak Bulundu
            </h3>
            <p className="text-slate-300 mb-4">
              Bu etkinlik için kaydedilmemiş bir taslak bulundu.
              {venue.draftSavedAt && (
                <span className="block text-sm text-slate-400 mt-1">
                  Son kayıt: {venue.draftSavedAt.toLocaleString("tr-TR")}
                </span>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  venue.clearDraft();
                  setShowDraftDialog(false);
                  // Sunucudan veriyi yükle
                  if (event?.venueLayout) {
                    venue.setPlacedTables(event.venueLayout.placedTables || []);
                    venue.setStageElements(
                      event.venueLayout.stageElements || []
                    );
                  }
                }}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Taslağı Sil
              </Button>
              <Button
                onClick={() => {
                  venue.applyDraft();
                  setShowDraftDialog(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Taslağı Yükle
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-save indicator */}
      {venue.hasDraft && venue.draftSavedAt && (
        <div className="fixed bottom-4 right-4 z-30 bg-slate-800/90 text-slate-400 text-xs px-3 py-1.5 rounded-full border border-slate-700">
          Taslak: {venue.draftSavedAt.toLocaleTimeString("tr-TR")}
        </div>
      )}

      {/* Şablon Kaydet Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileDown className="w-5 h-5 text-blue-400" />
              Şablon Olarak Kaydet
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Şablon Adı *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Örn: Düğün Salonu, Konser Alanı..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Açıklama (Opsiyonel)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Şablon hakkında kısa açıklama..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublicTemplate}
                  onChange={(e) => setIsPublicTemplate(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="isPublic" className="text-sm text-slate-300">
                  Herkese açık şablon (Marketplace'te görünsün)
                </label>
              </div>
            </div>
            <div className="text-sm text-slate-400 mt-4 mb-4 p-3 bg-slate-700/50 rounded-lg">
              <p className="font-medium mb-2">Bu şablon şunları içerecek:</p>
              <ul className="space-y-1">
                <li>
                  • {venue.placedTables.filter((t) => !t.isLoca).length} masa
                </li>
                <li>
                  • {venue.placedTables.filter((t) => t.isLoca).length} loca
                </li>
                <li>• {venue.stageElements.length} sahne/alan</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSaveTemplateModal(false);
                  setTemplateName("");
                  setTemplateDescription("");
                  setIsPublicTemplate(false);
                }}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                İptal
              </Button>
              <Button
                onClick={saveAsTemplate}
                disabled={!templateName.trim() || savingTemplate}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {savingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Kaydediliyor...
                  </>
                ) : (
                  "Kaydet"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Şablon Yükle Modal */}
      {showLoadTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-lg w-full mx-4 border border-slate-700 shadow-xl max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-emerald-400" />
              Şablon Yükle
            </h3>

            {loadingTemplates ? (
              <div className="text-center py-8 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                <p>Şablonlar yükleniyor...</p>
              </div>
            ) : savedTemplates.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileDown className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Henüz kaydedilmiş şablon yok.</p>
                <p className="text-sm mt-1">
                  Mevcut yerleşimi şablon olarak kaydedin.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {savedTemplates.map((template) => {
                  const layoutData = template.layoutData || {};
                  const tableCount = layoutData.placedTables?.length || 0;
                  const stageCount = layoutData.stageElements?.length || 0;
                  return (
                    <div
                      key={template.id}
                      className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white truncate">
                              {template.name}
                            </h4>
                            {template.isPublic && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                                Herkese Açık
                              </span>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {template.description}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {tableCount} masa/loca • {stageCount} sahne/alan
                            {template.usageCount > 0 && (
                              <span className="ml-2">
                                • {template.usageCount}x kullanıldı
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-600">
                            {new Date(template.createdAt).toLocaleString(
                              "tr-TR"
                            )}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              deleteTemplate(template.id, template.name)
                            }
                            className="text-red-400 border-red-400/50 hover:bg-red-400/10"
                          >
                            Sil
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => loadTemplate(template)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            Yükle
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-700">
              <Button
                variant="outline"
                onClick={() => setShowLoadTemplateModal(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Kapat
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3D Görünüm */}
      {show3DView && (
        <Venue3DView
          placedTables={venue.placedTables}
          stageElements={venue.stageElements}
          onClose={() => setShow3DView(false)}
        />
      )}
    </div>
  );
}

// ==================== TABLE RENDERER ====================
interface TableRendererProps {
  table: PlacedTable;
  isSelected: boolean;
  activeTool: "select" | "pan" | "lasso";
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

function TableRenderer({
  table,
  isSelected,
  activeTool,
  onMouseDown,
  onContextMenu,
}: TableRendererProps) {
  const config = TABLE_TYPE_CONFIG[table.type];
  const Icon = config.icon;
  const size = table.size || DEFAULT_TABLE_SIZE;

  // Font size based on table size
  const fontSize =
    size <= 28 ? "text-[8px]" : size <= 40 ? "text-xs" : "text-sm";
  const iconSize = size <= 28 ? "w-3 h-3" : size <= 40 ? "w-4 h-4" : "w-5 h-5";

  // LOCA için özel VIP booth/kanepe görünümü (3D preview ile uyumlu)
  if (table.isLoca) {
    const boothWidth = size * 1.2;
    const boothHeight = size * 0.9;

    return (
      <div
        className={`absolute transition-all ${
          isSelected
            ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 z-10"
            : ""
        } ${table.isLocked ? "opacity-80" : ""}`}
        style={{
          left: table.x - (boothWidth - size) / 2,
          top: table.y - (boothHeight - size) / 2,
          width: boothWidth,
          height: boothHeight,
          cursor: table.isLocked
            ? "not-allowed"
            : activeTool === "select"
            ? "move"
            : "default",
        }}
        onMouseDown={(e) => onMouseDown(e, table.id)}
        onContextMenu={(e) => onContextMenu(e, table.id)}
        title={`${table.locaName || `Loca ${table.tableNumber}`} (${
          table.capacity
        } kişi)`}
      >
        {/* Booth çerçevesi - neon efektli */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #0f172a 100%)",
            border: `2px solid ${config.color}`,
            boxShadow: `0 0 12px ${config.color}40, inset 0 0 8px ${config.color}20`,
          }}
        />

        {/* Arka duvar (sırtlık) */}
        <div
          className="absolute top-1 left-1/2 -translate-x-1/2 rounded-t-md"
          style={{
            width: boothWidth - 8,
            height: boothHeight * 0.3,
            background: "linear-gradient(180deg, #2d1f4e 0%, #1a1a2e 100%)",
            borderBottom: `1px solid ${config.color}60`,
          }}
        />

        {/* Kanepe oturma yeri */}
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md"
          style={{
            width: boothWidth - 12,
            height: boothHeight * 0.35,
            background: "linear-gradient(180deg, #3b2d5f 0%, #2d1f4e 100%)",
            border: `1px solid ${config.color}80`,
            boxShadow: `0 2px 6px rgba(0,0,0,0.4)`,
          }}
        />

        {/* Sol kol dayama */}
        <div
          className="absolute left-1 top-1/2 -translate-y-1/2 rounded-sm"
          style={{
            width: boothWidth * 0.08,
            height: boothHeight * 0.5,
            background: "linear-gradient(90deg, #2d1f4e 0%, #1a1a2e 100%)",
            borderRight: `1px solid ${config.color}40`,
          }}
        />

        {/* Sağ kol dayama */}
        <div
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm"
          style={{
            width: boothWidth * 0.08,
            height: boothHeight * 0.5,
            background: "linear-gradient(270deg, #2d1f4e 0%, #1a1a2e 100%)",
            borderLeft: `1px solid ${config.color}40`,
          }}
        />

        {/* Neon alt kenar */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-b-lg"
          style={{
            width: boothWidth - 4,
            height: 3,
            backgroundColor: config.color,
            boxShadow: `0 0 8px ${config.color}, 0 0 16px ${config.color}60`,
          }}
        />

        {/* Loca ismi/numarası */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${fontSize} font-bold text-white text-center`}
          style={{
            textShadow: `0 0 8px ${config.color}, 0 1px 2px rgba(0,0,0,0.8)`,
            letterSpacing: "0.5px",
          }}
        >
          {table.locaName || `L${table.tableNumber}`}
        </div>

        {/* VIP badge */}
        <div
          className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded text-[8px] font-bold"
          style={{
            backgroundColor: config.color,
            color: "#fff",
            boxShadow: `0 0 6px ${config.color}`,
          }}
        >
          VIP
        </div>

        {table.isLocked && (
          <div className="absolute -top-1 -left-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-[8px]">🔒</span>
          </div>
        )}
      </div>
    );
  }

  // Normal masa - yuvarlak
  return (
    <div
      className={`absolute rounded-full flex items-center justify-center text-white ${fontSize} font-bold shadow-lg transition-all ${
        isSelected
          ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900"
          : ""
      } ${table.isLocked ? "opacity-80" : ""}`}
      style={{
        left: table.x,
        top: table.y,
        width: size,
        height: size,
        backgroundColor: config.color,
        borderColor: config.borderColor,
        borderWidth: 2,
        borderStyle: "solid",
        cursor: table.isLocked
          ? "not-allowed"
          : activeTool === "select"
          ? "move"
          : "default",
      }}
      onMouseDown={(e) => onMouseDown(e, table.id)}
      onContextMenu={(e) => onContextMenu(e, table.id)}
      title={`Masa ${table.tableNumber} (${table.capacity} kişi)`}
    >
      <span>{table.tableNumber}</span>
      {table.isLocked && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
          <span className="text-[8px]">🔒</span>
        </div>
      )}
    </div>
  );
}
