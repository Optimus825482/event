"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Type,
  Image,
  QrCode,
  Trash2,
  ZoomIn,
  ZoomOut,
  Save,
  Eye,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyCenter,
  Loader2,
  X,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { invitationsApi, uploadApi, API_BASE } from "@/lib/api";

// Örnek misafir verileri (sadece misafir bilgileri örnek, etkinlik bilgileri gerçek veriden gelecek)
const SAMPLE_GUEST = {
  guestName: "Ahmet Yılmaz",
  tableLabel: "VIP Masa 1",
};

// Renk parlaklığını hesapla (0-255 arası)
const getLuminance = (hex: string): number => {
  const rgb = hex.replace("#", "").match(/.{2}/g);
  if (!rgb) return 255;
  const [r, g, b] = rgb.map((c) => parseInt(c, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

// Arka plana göre uygun yazı rengi döndür
const getContrastColor = (
  bgColor: string,
  isGradient: boolean = false
): { primary: string; secondary: string; accent: string } => {
  if (isGradient) {
    // Gradient'ler genelde koyu, beyaz yazı kullan
    return { primary: "#FFFFFF", secondary: "#E5E7EB", accent: "#93C5FD" };
  }

  const luminance = getLuminance(bgColor);

  if (luminance < 128) {
    // Koyu arka plan - açık yazılar
    return { primary: "#FFFFFF", secondary: "#D1D5DB", accent: "#93C5FD" };
  } else {
    // Açık arka plan - koyu yazılar
    return { primary: "#1F2937", secondary: "#6B7280", accent: "#3B82F6" };
  }
};

// Arka plan renk presetleri
const BACKGROUND_PRESETS = [
  { color: "#FFFFFF", label: "Beyaz" },
  { color: "#F8F9FA", label: "Açık Gri" },
  { color: "#1F2937", label: "Koyu" },
  { color: "#0F172A", label: "Lacivert" },
  { color: "#FEF3C7", label: "Krem" },
  { color: "#ECFDF5", label: "Mint" },
  { color: "#FDF2F8", label: "Pembe" },
  { color: "#EFF6FF", label: "Açık Mavi" },
  { color: "#F5F3FF", label: "Lavanta" },
  { color: "#FEF2F2", label: "Açık Kırmızı" },
];

// Gradient presetleri
const GRADIENT_PRESETS = [
  {
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    label: "Mor",
  },
  {
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    label: "Pembe",
  },
  {
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    label: "Mavi",
  },
  {
    gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    label: "Yeşil",
  },
  {
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    label: "Turuncu",
  },
  {
    gradient: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    label: "Pastel",
  },
];

// Genişletilmiş font seçenekleri
const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Verdana", label: "Verdana" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Poppins", label: "Poppins" },
  { value: "Raleway", label: "Raleway" },
  { value: "Oswald", label: "Oswald" },
  { value: "Merriweather", label: "Merriweather" },
  { value: "Dancing Script", label: "Dancing Script" },
  { value: "Pacifico", label: "Pacifico" },
  { value: "Great Vibes", label: "Great Vibes" },
  { value: "Cormorant Garamond", label: "Cormorant Garamond" },
];

// Element tipi
interface InvitationElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  textAlign?: "left" | "center" | "right";
  imageUrl?: string;
  objectFit?: "contain" | "cover" | "fill";
  borderRadius?: number;
  backgroundColor?: string;
  zIndex?: number;
}

interface InvitationEditorProps {
  eventId?: string;
  templateId?: string;
  onSave?: (data: any) => void;
  eventData?: {
    name: string;
    description?: string;
    eventDate: string;
    eventTime?: string;
    location?: string;
    hasReservations?: boolean;
  };
}

// Boyut presetleri
const SIZE_PRESETS = {
  A5: { width: 559, height: 794, label: "A5 (148x210mm)" },
  A6: { width: 397, height: 559, label: "A6 (105x148mm)" },
  SQUARE: { width: 600, height: 600, label: "Kare (600x600)" },
};

export function InvitationEditor({
  eventId,
  templateId,
  onSave,
  eventData,
}: InvitationEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<InvitationElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 559, height: 794 });
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundGradient, setBackgroundGradient] = useState<string | null>(
    null
  );
  const [zoom, setZoom] = useState(0.8);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  // Çoklu seçim
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  const selectedElement = elements.find((el) => el.id === selectedId);
  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));

  // Şablon/davetiye yükle
  useEffect(() => {
    const loadData = async () => {
      try {
        if (eventId) {
          const res = await invitationsApi.getEventInvitationElements(eventId);
          if (res.data.elements?.length) {
            setElements(res.data.elements);
            setCanvasSize({ width: res.data.width, height: res.data.height });
            if (res.data.backgroundColor)
              setBackgroundColor(res.data.backgroundColor);
            if (res.data.backgroundImage)
              setBackgroundImage(res.data.backgroundImage);
            if (res.data.backgroundGradient)
              setBackgroundGradient(res.data.backgroundGradient);
          } else {
            await loadDefaultTemplate();
          }
        } else if (templateId) {
          const res = await invitationsApi.getTemplate(templateId);
          setElements(res.data.elements || []);
          setCanvasSize({ width: res.data.width, height: res.data.height });
          if (res.data.backgroundColor)
            setBackgroundColor(res.data.backgroundColor);
          if (res.data.backgroundGradient)
            setBackgroundGradient(res.data.backgroundGradient);
        } else {
          await loadDefaultTemplate();
        }
      } catch (err) {
        console.error("Yükleme hatası:", err);
        await loadDefaultTemplate();
      } finally {
        setLoading(false);
      }
    };

    const loadDefaultTemplate = async () => {
      try {
        const res = await invitationsApi.getDefaultTemplate();
        setElements(res.data.elements || []);
        setCanvasSize({ width: res.data.width, height: res.data.height });
        if (res.data.backgroundColor)
          setBackgroundColor(res.data.backgroundColor);
        if (res.data.backgroundGradient)
          setBackgroundGradient(res.data.backgroundGradient);
      } catch {
        // Varsayılan boş canvas
      }
    };

    loadData();
  }, [eventId, templateId]);

  // Google Fonts yükle
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Montserrat:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;600;700&family=Lato:wght@400;700&family=Poppins:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Dancing+Script:wght@400;700&family=Pacifico&family=Great+Vibes&family=Cormorant+Garamond:wght@400;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Arka plan değiştiğinde yazı renklerini otomatik ayarla
  const adjustTextColorsForBackground = useCallback(() => {
    const colors = getContrastColor(backgroundColor, !!backgroundGradient);

    setElements((prev) =>
      prev.map((el) => {
        // Sadece metin elementlerinin renklerini güncelle
        if (
          [
            "text",
            "eventName",
            "eventDate",
            "eventTime",
            "eventLocation",
            "eventDescription",
            "guestName",
            "companyName",
            "reservationInfo",
          ].includes(el.type)
        ) {
          let newColor = colors.primary;

          // Element tipine göre renk belirle
          if (
            [
              "eventDescription",
              "eventTime",
              "eventLocation",
              "companyName",
            ].includes(el.type)
          ) {
            newColor = colors.secondary;
          } else if (el.type === "reservationInfo") {
            newColor = colors.accent;
          }

          return { ...el, color: newColor };
        }
        return el;
      })
    );
  }, [backgroundColor, backgroundGradient]);

  const updateElement = useCallback(
    (id: string, updates: Partial<InvitationElement>) => {
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
      );
    },
    []
  );

  const deleteElement = useCallback(
    (id: string) => {
      setElements((prev) => prev.filter((el) => el.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId]
  );

  const addElement = useCallback(
    (type: string) => {
      const newElement: InvitationElement = {
        id: `el-${Date.now()}`,
        type,
        x: canvasSize.width / 2 - 100,
        y: canvasSize.height / 2 - 25,
        width: 200,
        height: 50,
        zIndex: elements.length + 1,
      };

      // Tarih formatla
      const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return "";
        try {
          return new Date(dateStr).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
        } catch {
          return dateStr;
        }
      };

      const formatTime = (dateStr: string | undefined) => {
        if (!dateStr) return "";
        try {
          return new Date(dateStr).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          return "";
        }
      };

      switch (type) {
        case "text":
          newElement.content = "Metin";
          newElement.fontSize = 16;
          newElement.fontFamily = "Inter";
          newElement.color = "#1F2937";
          newElement.textAlign = "center";
          break;
        case "eventName":
          newElement.content = eventData?.name || "Etkinlik Adı";
          newElement.fontSize = 28;
          newElement.fontFamily = "Playfair Display";
          newElement.fontWeight = "bold";
          newElement.color = "#1F2937";
          newElement.textAlign = "center";
          newElement.width = 400;
          newElement.height = 60;
          break;
        case "eventDescription":
          newElement.content = eventData?.description || "Etkinlik açıklaması";
          newElement.fontSize = 14;
          newElement.fontFamily = "Inter";
          newElement.color = "#6B7280";
          newElement.textAlign = "center";
          newElement.width = 400;
          newElement.height = 60;
          break;
        case "eventDate":
          newElement.content = `📅 ${
            formatDate(eventData?.eventDate) || "Tarih"
          }`;
          newElement.fontSize = 16;
          newElement.fontFamily = "Montserrat";
          newElement.color = "#374151";
          newElement.textAlign = "center";
          newElement.width = 250;
          newElement.height = 35;
          break;
        case "eventTime":
          newElement.content = `🕐 ${
            formatTime(eventData?.eventDate) || "Saat"
          }`;
          newElement.fontSize = 16;
          newElement.fontFamily = "Montserrat";
          newElement.color = "#374151";
          newElement.textAlign = "center";
          newElement.width = 150;
          newElement.height = 35;
          break;
        case "eventLocation":
          newElement.content = `📍 ${eventData?.location || "Konum"}`;
          newElement.fontSize = 14;
          newElement.fontFamily = "Inter";
          newElement.color = "#6B7280";
          newElement.textAlign = "center";
          newElement.width = 300;
          newElement.height = 35;
          break;
        case "eventImage":
          newElement.width = 300;
          newElement.height = 150;
          newElement.objectFit = "cover";
          break;
        case "logo":
          newElement.width = 120;
          newElement.height = 120;
          newElement.objectFit = "contain";
          break;
        case "companyName":
          newElement.content = "Firma Adı";
          newElement.fontSize = 14;
          newElement.fontFamily = "Inter";
          newElement.color = "#9CA3AF";
          newElement.textAlign = "center";
          newElement.width = 200;
          newElement.height = 30;
          break;
        case "guestName":
          newElement.content = "{{guestName}}";
          newElement.fontSize = 20;
          newElement.fontFamily = "Montserrat";
          newElement.fontWeight = "600";
          newElement.color = "#1F2937";
          newElement.textAlign = "center";
          newElement.width = 300;
          newElement.height = 40;
          break;
        case "reservationInfo":
          newElement.content = "Masa: {{tableLabel}}";
          newElement.fontSize = 16;
          newElement.fontFamily = "Inter";
          newElement.color = "#3B82F6";
          newElement.textAlign = "center";
          newElement.width = 200;
          newElement.height = 35;
          break;
        case "qrcode":
          newElement.width = 130;
          newElement.height = 130;
          break;
        case "image":
          newElement.width = 150;
          newElement.height = 150;
          newElement.objectFit = "contain";
          break;
      }

      setElements((prev) => [...prev, newElement]);
      setSelectedId(newElement.id);
    },
    [canvasSize, elements.length, eventData]
  );

  // Otomatik yerleştir - canvas'a sığacak şekilde
  const autoArrange = useCallback(() => {
    if (elements.length === 0) return;

    const padding = 25;
    const gap = 12;
    const centerX = canvasSize.width / 2;
    const maxHeight = canvasSize.height - padding * 2;

    // Elementleri sırala
    const sortedElements = [...elements].sort((a, b) => {
      const order = [
        "logo",
        "eventName",
        "eventDescription",
        "eventDate",
        "eventTime",
        "eventLocation",
        "guestName",
        "text",
        "qrcode",
        "image",
      ];
      return order.indexOf(a.type) - order.indexOf(b.type);
    });

    // Mevcut toplam yüksekliği hesapla
    const totalContentHeight =
      sortedElements.reduce((sum, el) => sum + el.height, 0) +
      (sortedElements.length - 1) * gap;

    // Ölçek faktörü - her zaman canvas'a sığdır
    const scale = Math.min(1, maxHeight / totalContentHeight);

    let currentY = padding;

    const newElements = sortedElements.map((el) => {
      const newEl = { ...el };

      // Boyutları ölçekle
      newEl.height = Math.round(el.height * scale);
      newEl.width = Math.round(el.width * scale);

      // Yatay ortala
      newEl.x = Math.round(centerX - newEl.width / 2);

      // Dikey pozisyon
      newEl.y = Math.round(currentY);

      // Sonraki element için Y pozisyonunu güncelle
      currentY += newEl.height + Math.round(gap * scale);

      return newEl;
    });

    setElements(newElements);
  }, [elements, canvasSize]);

  // Seçili elementi yatay ortala
  const centerHorizontally = useCallback(() => {
    if (!selectedId) return;
    const element = elements.find((el) => el.id === selectedId);
    if (!element) return;
    const newX = Math.round((canvasSize.width - element.width) / 2);
    updateElement(selectedId, { x: newX });
  }, [selectedId, elements, canvasSize, updateElement]);

  // Seçili elementi dikey ortala
  const centerVertically = useCallback(() => {
    if (selectedIds.length > 0) {
      // Çoklu seçim varsa hepsini ortala
      setElements((prev) =>
        prev.map((el) => {
          if (selectedIds.includes(el.id)) {
            return {
              ...el,
              y: Math.round((canvasSize.height - el.height) / 2),
            };
          }
          return el;
        })
      );
    } else if (selectedId) {
      const element = elements.find((el) => el.id === selectedId);
      if (!element) return;
      const newY = Math.round((canvasSize.height - element.height) / 2);
      updateElement(selectedId, { y: newY });
    }
  }, [selectedId, selectedIds, elements, canvasSize, updateElement]);

  // Çoklu seçimi yatay ortala
  const alignSelectedHorizontally = useCallback(() => {
    if (selectedIds.length < 2) return;
    const centerX = canvasSize.width / 2;
    setElements((prev) =>
      prev.map((el) => {
        if (selectedIds.includes(el.id)) {
          return { ...el, x: Math.round(centerX - el.width / 2) };
        }
        return el;
      })
    );
  }, [selectedIds, canvasSize]);

  // Seçili elementleri sola hizala
  const alignSelectedLeft = useCallback(() => {
    if (selectedIds.length < 2) return;
    const minX = Math.min(...selectedElements.map((el) => el.x));
    setElements((prev) =>
      prev.map((el) => {
        if (selectedIds.includes(el.id)) {
          return { ...el, x: minX };
        }
        return el;
      })
    );
  }, [selectedIds, selectedElements]);

  // Seçili elementleri sağa hizala
  const alignSelectedRight = useCallback(() => {
    if (selectedIds.length < 2) return;
    const maxRight = Math.max(...selectedElements.map((el) => el.x + el.width));
    setElements((prev) =>
      prev.map((el) => {
        if (selectedIds.includes(el.id)) {
          return { ...el, x: maxRight - el.width };
        }
        return el;
      })
    );
  }, [selectedIds, selectedElements]);

  // Seçili elementleri üste hizala
  const alignSelectedTop = useCallback(() => {
    if (selectedIds.length < 2) return;
    const minY = Math.min(...selectedElements.map((el) => el.y));
    setElements((prev) =>
      prev.map((el) => {
        if (selectedIds.includes(el.id)) {
          return { ...el, y: minY };
        }
        return el;
      })
    );
  }, [selectedIds, selectedElements]);

  // Çakışma kontrolü - element taşındığında
  const checkAndResolveOverlap = useCallback(
    (movedId: string, newX: number, newY: number) => {
      const movedEl = elements.find((el) => el.id === movedId);
      if (!movedEl) return { x: newX, y: newY };

      const movedRect = {
        left: newX,
        right: newX + movedEl.width,
        top: newY,
        bottom: newY + movedEl.height,
      };

      // Diğer elementlerle çakışma kontrolü
      for (const el of elements) {
        if (el.id === movedId) continue;

        const elRect = {
          left: el.x,
          right: el.x + el.width,
          top: el.y,
          bottom: el.y + el.height,
        };

        // Çakışma var mı?
        const isOverlapping =
          movedRect.left < elRect.right &&
          movedRect.right > elRect.left &&
          movedRect.top < elRect.bottom &&
          movedRect.bottom > elRect.top;

        if (isOverlapping) {
          // En yakın boş alana taşı
          const overlapX = Math.min(
            movedRect.right - elRect.left,
            elRect.right - movedRect.left
          );
          const overlapY = Math.min(
            movedRect.bottom - elRect.top,
            elRect.bottom - movedRect.top
          );

          if (overlapY < overlapX) {
            // Dikey kaydır
            if (newY < el.y) {
              newY = el.y - movedEl.height - 5;
            } else {
              newY = el.y + el.height + 5;
            }
          } else {
            // Yatay kaydır
            if (newX < el.x) {
              newX = el.x - movedEl.width - 5;
            } else {
              newX = el.x + el.width + 5;
            }
          }
        }
      }

      // Canvas sınırları içinde tut
      newX = Math.max(0, Math.min(canvasSize.width - movedEl.width, newX));
      newY = Math.max(0, Math.min(canvasSize.height - movedEl.height, newY));

      return { x: newX, y: newY };
    },
    [elements, canvasSize]
  );

  // Sürükleme başlat
  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    const element = elements.find((el) => el.id === elementId);
    if (!element) return;

    // Ctrl tuşu ile çoklu seçim
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        if (prev.includes(elementId)) {
          return prev.filter((id) => id !== elementId);
        }
        return [...prev, elementId];
      });
      return;
    }

    // Eğer tıklanan element zaten çoklu seçimde ise, hepsini taşı
    if (selectedIds.includes(elementId)) {
      setIsDragging(true);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX / zoom - element.x - rect.left / zoom,
          y: e.clientY / zoom - element.y - rect.top / zoom,
        });
      }
      return;
    }

    // Normal tek seçim
    setSelectedId(elementId);
    setSelectedIds([]);
    setIsDragging(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX / zoom - element.x - rect.left / zoom,
        y: e.clientY / zoom - element.y - rect.top / zoom,
      });
    }
  };

  // Canvas'ta seçim kutusu başlat
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    setIsSelecting(true);
    setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
    setSelectedId(null);
    setSelectedIds([]);
  };

  // Resize başlat
  const handleResizeStart = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    const element = elements.find((el) => el.id === elementId);
    if (!element) return;

    setSelectedId(elementId);
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: element.width,
      height: element.height,
    });
  };

  // Mouse move - sürükleme, resize ve seçim kutusu
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();

      // Seçim kutusu çizimi
      if (isSelecting && selectionBox) {
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        setSelectionBox((prev) =>
          prev ? { ...prev, endX: x, endY: y } : null
        );
        return;
      }

      // Çoklu seçim sürükleme
      if (isDragging && selectedIds.length > 0) {
        const firstEl = elements.find((el) => selectedIds.includes(el.id));
        if (!firstEl) return;

        const newX = e.clientX / zoom - dragOffset.x - rect.left / zoom;
        const newY = e.clientY / zoom - dragOffset.y - rect.top / zoom;
        const deltaX = newX - firstEl.x;
        const deltaY = newY - firstEl.y;

        setElements((prev) =>
          prev.map((el) => {
            if (selectedIds.includes(el.id)) {
              return {
                ...el,
                x: Math.max(
                  0,
                  Math.min(canvasSize.width - el.width, el.x + deltaX)
                ),
                y: Math.max(
                  0,
                  Math.min(canvasSize.height - el.height, el.y + deltaY)
                ),
              };
            }
            return el;
          })
        );
        return;
      }

      // Tek element sürükleme
      if (isDragging && selectedId) {
        const newX = Math.max(
          0,
          Math.min(
            canvasSize.width - 50,
            e.clientX / zoom - dragOffset.x - rect.left / zoom
          )
        );
        const newY = Math.max(
          0,
          Math.min(
            canvasSize.height - 50,
            e.clientY / zoom - dragOffset.y - rect.top / zoom
          )
        );
        updateElement(selectedId, { x: newX, y: newY });
      }

      // Resize
      if (isResizing && selectedId) {
        const deltaX = (e.clientX - resizeStart.x) / zoom;
        const deltaY = (e.clientY - resizeStart.y) / zoom;
        const newWidth = Math.max(30, resizeStart.width + deltaX);
        const newHeight = Math.max(30, resizeStart.height + deltaY);
        updateElement(selectedId, { width: newWidth, height: newHeight });
      }
    },
    [
      isDragging,
      isResizing,
      isSelecting,
      selectedId,
      selectedIds,
      selectionBox,
      zoom,
      dragOffset,
      resizeStart,
      canvasSize,
      updateElement,
      elements,
    ]
  );

  const handleMouseUp = useCallback(() => {
    // Seçim kutusu ile seçim tamamla
    if (isSelecting && selectionBox) {
      const box = {
        left: Math.min(selectionBox.startX, selectionBox.endX),
        right: Math.max(selectionBox.startX, selectionBox.endX),
        top: Math.min(selectionBox.startY, selectionBox.endY),
        bottom: Math.max(selectionBox.startY, selectionBox.endY),
      };

      const selected = elements
        .filter((el) => {
          return (
            el.x < box.right &&
            el.x + el.width > box.left &&
            el.y < box.bottom &&
            el.y + el.height > box.top
          );
        })
        .map((el) => el.id);

      setSelectedIds(selected);
      setSelectionBox(null);
    }

    setIsDragging(false);
    setIsResizing(false);
    setIsSelecting(false);
  }, [isSelecting, selectionBox, elements]);

  // Görsel yükle
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "event" | "element"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let res;
      if (type === "logo") {
        res = await uploadApi.uploadLogo(file);
      } else if (type === "event") {
        res = await uploadApi.uploadEventImage(file);
      } else {
        res = await uploadApi.uploadInvitationImage(file);
      }

      const imageUrl = API_BASE + res.data.data.url;
      setUploadedImages((prev) => [...prev, imageUrl]);

      if (
        selectedId &&
        (selectedElement?.type === "image" ||
          selectedElement?.type === "logo" ||
          selectedElement?.type === "eventImage")
      ) {
        updateElement(selectedId, { imageUrl });

        // Görsel yüklenince otomatik kaydet
        if (eventId) {
          const updatedElements = elements.map((el) =>
            el.id === selectedId ? { ...el, imageUrl } : el
          );

          try {
            await invitationsApi.saveEventInvitation(eventId, {
              customElements: updatedElements,
              width: canvasSize.width,
              height: canvasSize.height,
              backgroundColor,
              backgroundImage,
              backgroundGradient,
            });
          } catch (saveErr) {
            console.error("Otomatik kaydetme hatası:", saveErr);
          }
        }
      }
    } catch (err) {
      console.error("Yükleme hatası:", err);
    }
  };

  // Kaydet
  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        customElements: elements,
        width: canvasSize.width,
        height: canvasSize.height,
        backgroundColor,
        backgroundImage,
        backgroundGradient,
      };

      if (eventId) {
        await invitationsApi.saveEventInvitation(eventId, data);
      }

      onSave?.(data);
    } catch (err) {
      console.error("Kaydetme hatası:", err);
    } finally {
      setSaving(false);
    }
  };

  // Element render
  const renderElement = (element: InvitationElement) => {
    const isSelected = selectedId === element.id;
    const isMultiSelected = selectedIds.includes(element.id);
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      transform: element.rotation
        ? `rotate(${element.rotation}deg)`
        : undefined,
      zIndex: element.zIndex || 1,
      cursor: "move",
      border: isSelected
        ? "2px solid #3B82F6"
        : isMultiSelected
        ? "2px solid #10B981"
        : "1px dashed transparent",
      borderRadius: element.borderRadius,
      backgroundColor: element.backgroundColor,
    };

    const textStyle: React.CSSProperties = {
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      fontWeight: element.fontWeight as any,
      color: element.color,
      textAlign: element.textAlign,
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent:
        element.textAlign === "center"
          ? "center"
          : element.textAlign === "right"
          ? "flex-end"
          : "flex-start",
    };

    return (
      <div
        key={element.id}
        style={baseStyle}
        onMouseDown={(e) => handleMouseDown(e, element.id)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(element.id);
        }}
      >
        {[
          "text",
          "eventName",
          "eventDate",
          "eventTime",
          "eventLocation",
          "eventDescription",
          "guestName",
          "companyName",
          "reservationInfo",
        ].includes(element.type) && (
          <div style={textStyle}>{element.content}</div>
        )}
        {element.type === "qrcode" && (
          <div className="w-full h-full bg-slate-200 flex items-center justify-center border-2 border-dashed border-slate-400 rounded">
            <QrCode className="w-12 h-12 text-slate-500" />
          </div>
        )}
        {(element.type === "image" ||
          element.type === "logo" ||
          element.type === "eventImage") && (
          <div className="w-full h-full bg-slate-200 flex items-center justify-center overflow-hidden rounded">
            {element.imageUrl ? (
              <img
                src={element.imageUrl}
                alt=""
                className="w-full h-full"
                style={{ objectFit: element.objectFit }}
              />
            ) : (
              <Image className="w-8 h-8 text-slate-400" />
            )}
          </div>
        )}
        {isSelected && (
          <>
            <div className="absolute -top-6 left-0 flex gap-1">
              <button
                onClick={() => deleteElement(element.id)}
                className="p-1 bg-red-500 rounded text-white text-xs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            {/* Resize handle - sağ alt köşe */}
            <div
              className="absolute -right-2 -bottom-2 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize border-2 border-white shadow-md"
              onMouseDown={(e) => handleResizeStart(e, element.id)}
            />
          </>
        )}
      </div>
    );
  };

  // Önizleme için element render (örnek verilerle + görseller)
  const renderPreviewElement = (element: InvitationElement) => {
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      transform: element.rotation
        ? `rotate(${element.rotation}deg)`
        : undefined,
      zIndex: element.zIndex || 1,
      borderRadius: element.borderRadius,
      backgroundColor: element.backgroundColor,
    };

    const textStyle: React.CSSProperties = {
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      fontWeight: element.fontWeight as any,
      color: element.color,
      textAlign: element.textAlign,
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent:
        element.textAlign === "center"
          ? "center"
          : element.textAlign === "right"
          ? "flex-end"
          : "flex-start",
    };

    // Placeholder'ları gerçek etkinlik verileri + örnek misafir verileriyle değiştir
    const getPreviewContent = (content: string | undefined) => {
      if (!content) return "";

      // Tarih formatla
      const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return "Tarih belirtilmedi";
        try {
          return new Date(dateStr).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
        } catch {
          return dateStr;
        }
      };

      // Saat formatla
      const formatTime = (dateStr: string | undefined) => {
        if (!dateStr) return "Saat belirtilmedi";
        try {
          return new Date(dateStr).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          return eventData?.eventTime || "21:00";
        }
      };

      return content
        .replace(/\{\{eventName\}\}/g, eventData?.name || "Etkinlik Adı")
        .replace(
          /\{\{eventDescription\}\}/g,
          eventData?.description || "Etkinlik açıklaması"
        )
        .replace(/\{\{eventDate\}\}/g, formatDate(eventData?.eventDate))
        .replace(/\{\{eventTime\}\}/g, formatTime(eventData?.eventDate))
        .replace(
          /\{\{eventLocation\}\}/g,
          eventData?.location || "Konum belirtilmedi"
        )
        .replace(/\{\{guestName\}\}/g, SAMPLE_GUEST.guestName)
        .replace(/\{\{tableLabel\}\}/g, SAMPLE_GUEST.tableLabel);
    };

    return (
      <div key={`preview-${element.id}`} style={baseStyle}>
        {[
          "text",
          "eventName",
          "eventDate",
          "eventTime",
          "eventLocation",
          "eventDescription",
          "guestName",
          "companyName",
          "reservationInfo",
        ].includes(element.type) && (
          <div style={textStyle}>{getPreviewContent(element.content)}</div>
        )}
        {element.type === "qrcode" && (
          <div className="w-full h-full bg-white flex items-center justify-center rounded p-2">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <rect fill="white" width="100" height="100" />
              <g fill="black">
                <rect x="5" y="5" width="25" height="25" />
                <rect x="8" y="8" width="19" height="19" fill="white" />
                <rect x="11" y="11" width="13" height="13" />
                <rect x="70" y="5" width="25" height="25" />
                <rect x="73" y="8" width="19" height="19" fill="white" />
                <rect x="76" y="11" width="13" height="13" />
                <rect x="5" y="70" width="25" height="25" />
                <rect x="8" y="73" width="19" height="19" fill="white" />
                <rect x="11" y="76" width="13" height="13" />
                <rect x="35" y="5" width="5" height="5" />
                <rect x="45" y="5" width="5" height="5" />
                <rect x="55" y="5" width="5" height="5" />
                <rect x="35" y="35" width="5" height="5" />
                <rect x="45" y="35" width="5" height="5" />
                <rect x="55" y="35" width="5" height="5" />
                <rect x="65" y="35" width="5" height="5" />
                <rect x="35" y="55" width="5" height="5" />
                <rect x="45" y="55" width="5" height="5" />
                <rect x="65" y="55" width="5" height="5" />
                <rect x="35" y="75" width="5" height="5" />
                <rect x="55" y="75" width="5" height="5" />
                <rect x="75" y="75" width="5" height="5" />
                <rect x="85" y="75" width="5" height="5" />
              </g>
            </svg>
          </div>
        )}
        {(element.type === "image" ||
          element.type === "logo" ||
          element.type === "eventImage") && (
          <div
            className="w-full h-full flex items-center justify-center overflow-hidden rounded"
            style={{
              backgroundColor: element.imageUrl ? "transparent" : "#f1f5f9",
            }}
          >
            {element.imageUrl ? (
              <img
                src={element.imageUrl}
                alt=""
                className="w-full h-full"
                style={{ objectFit: element.objectFit }}
              />
            ) : (
              <div className="text-slate-400 text-center">
                <Image className="w-8 h-8 mx-auto mb-1" />
                <span className="text-xs">Görsel</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Sol Panel - Araçlar */}
      <div className="w-64 bg-slate-800 rounded-lg p-4 space-y-4 flex-shrink-0 overflow-y-auto max-h-[calc(100vh-120px)]">
        <h3 className="font-semibold text-sm text-slate-300">
          Etkinlik Bilgileri
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => addElement("eventName")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <Type className="w-4 h-4 text-blue-400" /> Etkinlik Adı
          </button>
          <button
            onClick={() => addElement("eventDescription")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <Type className="w-4 h-4 text-cyan-400" /> Açıklama
          </button>
          <button
            onClick={() => addElement("eventDate")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <Type className="w-4 h-4 text-green-400" /> Tarih
          </button>
          <button
            onClick={() => addElement("eventTime")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <Type className="w-4 h-4 text-emerald-400" /> Saat
          </button>
          <button
            onClick={() => addElement("eventLocation")}
            disabled={!eventData?.location}
            className={`p-2 rounded-lg flex flex-col items-center gap-1 text-xs ${
              eventData?.location
                ? "bg-slate-700"
                : "bg-slate-800 opacity-50 cursor-not-allowed"
            }`}
          >
            <Type className="w-4 h-4 text-red-400" /> Konum
          </button>
          <button
            onClick={() => addElement("eventImage")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <Image className="w-4 h-4 text-pink-400" /> Etkinlik Görseli
          </button>
        </div>

        <h3 className="font-semibold text-sm text-slate-300 pt-3">
          Firma & Misafir
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => addElement("logo")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <Image className="w-4 h-4 text-yellow-400" /> Logo
          </button>
          <button
            onClick={() => addElement("companyName")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <Type className="w-4 h-4 text-orange-400" /> Firma Adı
          </button>
          <button
            onClick={() => addElement("guestName")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <Type className="w-4 h-4 text-purple-400" /> Misafir Adı
          </button>
          <button
            onClick={() => addElement("reservationInfo")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <Type className="w-4 h-4 text-indigo-400" /> Rezervasyon
          </button>
        </div>

        <h3 className="font-semibold text-sm text-slate-300 pt-3">Diğer</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => addElement("qrcode")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <QrCode className="w-4 h-4" /> QR Kod
          </button>
          <button
            onClick={() => addElement("image")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <Image className="w-4 h-4" /> Görsel
          </button>
          <button
            onClick={() => addElement("text")}
            className="p-2 bg-slate-700 rounded-lg flex flex-col items-center gap-1 text-xs"
          >
            <Type className="w-4 h-4" /> Serbest Metin
          </button>
        </div>

        {/* Otomatik Yerleştir */}
        <div className="pt-4 border-t border-slate-700">
          <Button variant="outline" className="w-full" onClick={autoArrange}>
            <Wand2 className="w-4 h-4 mr-2" /> Otomatik Yerleştir
          </Button>
        </div>

        {/* Boyut Seçimi */}
        <div className="pt-4 border-t border-slate-700">
          <h3 className="font-semibold text-sm text-slate-300 mb-2">Boyut</h3>
          <select
            value={`${canvasSize.width}x${canvasSize.height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split("x").map(Number);
              setCanvasSize({ width: w, height: h });
            }}
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
          >
            {Object.entries(SIZE_PRESETS).map(([key, val]) => (
              <option key={key} value={`${val.width}x${val.height}`}>
                {val.label}
              </option>
            ))}
          </select>
        </div>

        {/* Arkaplan */}
        <div className="pt-4 border-t border-slate-700">
          <h3 className="font-semibold text-sm text-slate-300 mb-2">
            Arkaplan
          </h3>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => {
                setBackgroundColor(e.target.value);
                setBackgroundGradient(null);
              }}
              className="w-10 h-10 rounded cursor-pointer border-2 border-slate-600"
            />
            <span className="text-sm text-slate-400">{backgroundColor}</span>
          </div>
          <div className="mb-3">
            <label className="text-xs text-slate-400 mb-1 block">
              Hazır Renkler
            </label>
            <div className="grid grid-cols-5 gap-1">
              {BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  onClick={() => {
                    setBackgroundColor(preset.color);
                    setBackgroundGradient(null);
                  }}
                  className={`w-8 h-8 rounded border-2 transition-all ${
                    backgroundColor === preset.color && !backgroundGradient
                      ? "border-blue-500 scale-110"
                      : "border-slate-600"
                  }`}
                  style={{ backgroundColor: preset.color }}
                  title={preset.label}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Gradientler
            </label>
            <div className="grid grid-cols-3 gap-1">
              {GRADIENT_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => setBackgroundGradient(preset.gradient)}
                  className={`w-full h-8 rounded border-2 transition-all ${
                    backgroundGradient === preset.gradient
                      ? "border-blue-500 scale-105"
                      : "border-slate-600"
                  }`}
                  style={{ background: preset.gradient }}
                  title={preset.label}
                />
              ))}
            </div>
            {backgroundGradient && (
              <button
                onClick={() => setBackgroundGradient(null)}
                className="mt-2 text-xs text-red-400 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Gradienti Kaldır
              </button>
            )}
          </div>

          {/* Otomatik Kontrast Ayarla */}
          <button
            onClick={adjustTextColorsForBackground}
            className="w-full mt-3 p-2 bg-slate-700 rounded-lg text-xs text-slate-300 flex items-center justify-center gap-2"
          >
            <Wand2 className="w-4 h-4" /> Yazı Renklerini Otomatik Ayarla
          </button>
        </div>
      </div>

      {/* Orta - Canvas */}
      <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-auto flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
              className="p-2 bg-slate-700 rounded"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm w-16 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
              className="p-2 bg-slate-700 rounded"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div
            style={{
              width: canvasSize.width * zoom,
              height: canvasSize.height * zoom,
              position: "relative",
            }}
          >
            <div
              ref={canvasRef}
              style={{
                width: canvasSize.width,
                height: canvasSize.height,
                backgroundColor: backgroundGradient
                  ? "transparent"
                  : backgroundColor,
                backgroundImage: backgroundGradient
                  ? backgroundGradient
                  : backgroundImage
                  ? `url(${backgroundImage})`
                  : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                position: "absolute",
                top: 0,
                left: 0,
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={() => {
                setSelectedId(null);
                setSelectedIds([]);
              }}
            >
              {elements.map(renderElement)}

              {/* Seçim kutusu */}
              {selectionBox && (
                <div
                  style={{
                    position: "absolute",
                    left: Math.min(selectionBox.startX, selectionBox.endX),
                    top: Math.min(selectionBox.startY, selectionBox.endY),
                    width: Math.abs(selectionBox.endX - selectionBox.startX),
                    height: Math.abs(selectionBox.endY - selectionBox.startY),
                    border: "2px dashed #3B82F6",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sağ Panel - Özellikler */}
      <div className="w-72 bg-slate-800 rounded-lg p-4 space-y-4 flex-shrink-0 overflow-y-auto max-h-[calc(100vh-120px)]">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-sm text-slate-300">Özellikler</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Çoklu seçim hizalama */}
        {selectedIds.length > 1 && (
          <div className="p-3 bg-emerald-900/30 rounded-lg border border-emerald-700">
            <p className="text-xs text-emerald-400 mb-2">
              {selectedIds.length} öğe seçili
            </p>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={alignSelectedLeft}
                className="p-1.5 bg-slate-700 rounded text-slate-300 text-xs"
                title="Sola Hizala"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                onClick={alignSelectedHorizontally}
                className="p-1.5 bg-slate-700 rounded text-slate-300 text-xs"
                title="Yatay Ortala"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                onClick={alignSelectedRight}
                className="p-1.5 bg-slate-700 rounded text-slate-300 text-xs"
                title="Sağa Hizala"
              >
                <AlignRight className="w-4 h-4" />
              </button>
              <button
                onClick={alignSelectedTop}
                className="p-1.5 bg-slate-700 rounded text-slate-300 text-xs"
                title="Üste Hizala"
              >
                <AlignVerticalJustifyCenter className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setSelectedIds([])}
              className="mt-2 text-xs text-red-400 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Seçimi Temizle
            </button>
          </div>
        )}

        {selectedElement ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400 uppercase">
                {selectedElement.type}
              </div>
              {/* Ortalama butonları */}
              <div className="flex gap-1">
                <button
                  onClick={centerHorizontally}
                  className="p-1.5 bg-slate-700 rounded text-slate-300"
                  title="Yatay Ortala"
                >
                  <AlignHorizontalJustifyCenter className="w-4 h-4" />
                </button>
                <button
                  onClick={centerVertically}
                  className="p-1.5 bg-slate-700 rounded text-slate-300"
                  title="Dikey Ortala"
                >
                  <AlignVerticalJustifyCenter className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">X</label>
                <input
                  type="number"
                  value={Math.round(selectedElement.x)}
                  onChange={(e) =>
                    updateElement(selectedId!, { x: Number(e.target.value) })
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Y</label>
                <input
                  type="number"
                  value={Math.round(selectedElement.y)}
                  onChange={(e) =>
                    updateElement(selectedId!, { y: Number(e.target.value) })
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">Genişlik</label>
                <input
                  type="number"
                  value={Math.round(selectedElement.width)}
                  onChange={(e) =>
                    updateElement(selectedId!, {
                      width: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Yükseklik</label>
                <input
                  type="number"
                  value={Math.round(selectedElement.height)}
                  onChange={(e) =>
                    updateElement(selectedId!, {
                      height: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                />
              </div>
            </div>

            {[
              "text",
              "eventName",
              "eventDate",
              "eventTime",
              "eventLocation",
              "eventDescription",
              "guestName",
              "companyName",
              "reservationInfo",
            ].includes(selectedElement.type) && (
              <>
                <div>
                  <label className="text-xs text-slate-400">İçerik</label>
                  <input
                    type="text"
                    value={selectedElement.content || ""}
                    onChange={(e) =>
                      updateElement(selectedId!, { content: e.target.value })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Font</label>
                  <select
                    value={selectedElement.fontFamily || "Inter"}
                    onChange={(e) =>
                      updateElement(selectedId!, { fontFamily: e.target.value })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option
                        key={f.value}
                        value={f.value}
                        style={{ fontFamily: f.value }}
                      >
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400">Boyut</label>
                    <input
                      type="number"
                      value={selectedElement.fontSize || 16}
                      onChange={(e) =>
                        updateElement(selectedId!, {
                          fontSize: Number(e.target.value),
                        })
                      }
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Kalınlık</label>
                    <select
                      value={selectedElement.fontWeight || "normal"}
                      onChange={(e) =>
                        updateElement(selectedId!, {
                          fontWeight: e.target.value,
                        })
                      }
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                    >
                      <option value="normal">Normal</option>
                      <option value="500">Medium</option>
                      <option value="600">Semibold</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Renk</label>
                  <input
                    type="color"
                    value={selectedElement.color || "#000000"}
                    onChange={(e) =>
                      updateElement(selectedId!, { color: e.target.value })
                    }
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <div className="flex gap-1 ml-auto">
                    <button
                      onClick={() =>
                        updateElement(selectedId!, { textAlign: "left" })
                      }
                      className={`p-1 rounded ${
                        selectedElement.textAlign === "left"
                          ? "bg-blue-600"
                          : "bg-slate-700"
                      }`}
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        updateElement(selectedId!, { textAlign: "center" })
                      }
                      className={`p-1 rounded ${
                        selectedElement.textAlign === "center"
                          ? "bg-blue-600"
                          : "bg-slate-700"
                      }`}
                    >
                      <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        updateElement(selectedId!, { textAlign: "right" })
                      }
                      className={`p-1 rounded ${
                        selectedElement.textAlign === "right"
                          ? "bg-blue-600"
                          : "bg-slate-700"
                      }`}
                    >
                      <AlignRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {(selectedElement.type === "image" ||
              selectedElement.type === "logo" ||
              selectedElement.type === "eventImage") && (
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Görsel Yükle</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) =>
                    handleImageUpload(
                      e,
                      selectedElement.type === "logo"
                        ? "logo"
                        : selectedElement.type === "eventImage"
                        ? "event"
                        : "element"
                    )
                  }
                  className="w-full text-xs"
                />
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-1 mt-2">
                    {uploadedImages.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt=""
                        className="w-full h-12 object-cover rounded cursor-pointer border-2 border-transparent"
                        onClick={() =>
                          updateElement(selectedId!, { imageUrl: img })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Düzenlemek için bir element seçin
          </p>
        )}

        <div className="pt-4 border-t border-slate-700">
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              const name = prompt("Şablon adı:");
              if (name) {
                await invitationsApi.createTemplate({
                  name,
                  elements,
                  width: canvasSize.width,
                  height: canvasSize.height,
                  backgroundColor,
                  backgroundImage,
                  backgroundGradient,
                });
                alert("Şablon kaydedildi!");
              }
            }}
          >
            Şablon Olarak Kaydet
          </Button>
        </div>
      </div>

      {/* Önizleme Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-8"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-slate-900 rounded-xl p-6 max-w-4xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Davetiye Önizleme
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Misafirlere gönderilecek davetiyenin örnek görünümü
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 rounded-lg bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                Etkinlik Bilgileri{" "}
                {eventData?.hasReservations && (
                  <span className="text-xs text-amber-400 ml-2">
                    (Rezervasyon mevcut - konum değiştirilemez)
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Etkinlik:</span>
                  <p className="text-white font-medium">
                    {eventData?.name || "Etkinlik Adı"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Tarih:</span>
                  <p className="text-white font-medium">
                    {eventData?.eventDate
                      ? new Date(eventData.eventDate).toLocaleDateString(
                          "tr-TR",
                          { day: "numeric", month: "long", year: "numeric" }
                        )
                      : "Tarih belirtilmedi"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Konum:</span>
                  <p className="text-white font-medium">
                    {eventData?.location || "Konum belirtilmedi"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Örnek Misafir:</span>
                  <p className="text-white font-medium">
                    {SAMPLE_GUEST.guestName}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <div
                style={{
                  width: canvasSize.width * 0.8,
                  height: canvasSize.height * 0.8,
                  backgroundColor: backgroundGradient
                    ? undefined
                    : backgroundColor,
                  background: backgroundGradient || backgroundColor,
                  backgroundSize: "cover",
                  position: "relative",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: canvasSize.width,
                    height: canvasSize.height,
                    transform: "scale(0.8)",
                    transformOrigin: "top left",
                    position: "relative",
                  }}
                >
                  {elements.map((el) => renderPreviewElement(el))}
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-slate-500">
              Bu önizleme, davetiyenin misafirlere nasıl görüneceğini gösterir.
              <br />
              QR kod her misafir için benzersiz olarak oluşturulacaktır.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
