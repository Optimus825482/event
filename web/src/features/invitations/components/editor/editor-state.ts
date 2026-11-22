import {
  ELEMENT_TYPES,
  INVITATION_SIZES,
  type ElementType,
  type InvitationElement,
  type InvitationSizeKey,
} from "../../elements";

export type EditorDesign = {
  size: InvitationSizeKey;
  width: number;
  height: number;
  backgroundColor: string | null;
  backgroundGradient: string | null;
  backgroundImage: string | null;
  elements: InvitationElement[];
};

export type EditorState = { design: EditorDesign; selectedId: string | null; dirty: boolean };

export type EditorAction =
  | { type: "add"; elementType: ElementType; id: string }
  | { type: "select"; id: string | null }
  | { type: "patch"; id: string; patch: Partial<InvitationElement> }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "resize"; id: string; width: number; height: number }
  | { type: "remove"; id: string }
  | { type: "duplicate"; id: string; newId: string }
  | { type: "layer"; id: string; direction: "up" | "down" }
  | { type: "design"; patch: Partial<Omit<EditorDesign, "elements">> }
  | { type: "size"; size: InvitationSizeKey }
  | { type: "reset"; design: EditorDesign };

export const ELEMENT_LABELS: Record<ElementType, string> = {
  text: "Metin",
  image: "Görsel",
  qrcode: "QR kod",
  guestName: "Misafir adı",
  eventName: "Etkinlik adı",
  eventDate: "Tarih",
  eventTime: "Saat",
  eventLocation: "Konum",
  eventDescription: "Açıklama",
  logo: "Logo",
};

export function isElementType(value: string): value is ElementType {
  return (ELEMENT_TYPES as readonly string[]).includes(value);
}

function defaultsFor(type: ElementType, id: string, z: number): InvitationElement {
  const textual: Partial<InvitationElement> = { fontFamily: "Inter", fontSize: 18, color: "#1F2937", textAlign: "center" };
  switch (type) {
    case "qrcode":
      return { id, type, x: 200, y: 400, width: 150, height: 150, zIndex: z };
    case "logo":
      return { id, type, x: 230, y: 40, width: 100, height: 100, objectFit: "contain", zIndex: z };
    case "image":
      return { id, type, x: 60, y: 60, width: 200, height: 150, objectFit: "cover", zIndex: z };
    case "text":
      return { id, type, x: 40, y: 200, width: 400, height: 50, content: "Yeni metin", ...textual, zIndex: z };
    default:
      return { id, type, x: 40, y: 200, width: 400, height: 50, content: `{{${type}}}`, ...textual, zIndex: z };
  }
}

function maxZ(elements: InvitationElement[]): number {
  return elements.reduce((max, e) => Math.max(max, e.zIndex ?? 0), 0);
}

function mapElement(state: EditorState, id: string, fn: (e: InvitationElement) => InvitationElement): EditorState {
  return {
    ...state,
    dirty: true,
    design: { ...state.design, elements: state.design.elements.map((e) => (e.id === id ? fn(e) : e)) },
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { design } = state;
  switch (action.type) {
    case "reset":
      return { design: action.design, selectedId: null, dirty: false };
    case "select":
      return { ...state, selectedId: action.id };
    case "add":
      return {
        selectedId: action.id,
        dirty: true,
        design: { ...design, elements: [...design.elements, defaultsFor(action.elementType, action.id, maxZ(design.elements) + 1)] },
      };
    case "patch":
      return mapElement(state, action.id, (e) => ({ ...e, ...action.patch }));
    case "move":
      return mapElement(state, action.id, (e) => ({ ...e, x: Math.round(action.x), y: Math.round(action.y) }));
    case "resize":
      return mapElement(state, action.id, (e) => ({ ...e, width: Math.max(10, Math.round(action.width)), height: Math.max(10, Math.round(action.height)) }));
    case "remove":
      return {
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        dirty: true,
        design: { ...design, elements: design.elements.filter((e) => e.id !== action.id) },
      };
    case "duplicate": {
      const source = design.elements.find((e) => e.id === action.id);
      if (!source) return state;
      const copy = { ...source, id: action.newId, x: source.x + 16, y: source.y + 16, zIndex: maxZ(design.elements) + 1 };
      return { selectedId: action.newId, dirty: true, design: { ...design, elements: [...design.elements, copy] } };
    }
    case "layer":
      return mapElement(state, action.id, (e) => ({
        ...e,
        zIndex: Math.max(0, (e.zIndex ?? 0) + (action.direction === "up" ? 1 : -1)),
      }));
    case "design":
      return { ...state, dirty: true, design: { ...design, ...action.patch } };
    case "size": {
      const preset = INVITATION_SIZES[action.size];
      return { ...state, dirty: true, design: { ...design, size: action.size, width: preset.width, height: preset.height } };
    }
  }
}

export const BACKGROUND_PRESETS = ["#FFFFFF", "#F8FAFC", "#FEF3C7", "#DBEAFE", "#1F2937", "#7F1D1D"] as const;

export const GRADIENT_PRESETS = [
  { label: "Gün batımı", value: "linear-gradient(135deg, #f97316, #ec4899)" },
  { label: "Okyanus", value: "linear-gradient(135deg, #0ea5e9, #6366f1)" },
  { label: "Orman", value: "linear-gradient(135deg, #16a34a, #065f46)" },
  { label: "Gece", value: "linear-gradient(180deg, #1e293b, #020617)" },
] as const;

export const FONT_OPTIONS = ["Inter", "Georgia", "Times New Roman", "Courier New", "Arial"] as const;

export const PREVIEW_FIELDS = {
  guestName: "Ayşe Yılmaz",
  eventDate: "15 Mart 2027",
  eventTime: "20:00",
  eventLocation: "",
  tableLabel: "A1",
} as const;

/** Kayıtlı genişlik/yüksekliğe uyan boyut ön ayarı; yoksa "CUSTOM". */
export function sizeKeyFor(width: number, height: number): InvitationSizeKey {
  const match = (["A5", "A6", "SQUARE"] as const).find((k) => INVITATION_SIZES[k].width === width && INVITATION_SIZES[k].height === height);
  return match ?? "CUSTOM";
}

export function designFrom(source: {
  width: number;
  height: number;
  backgroundColor: string | null;
  backgroundGradient: string | null;
  backgroundImage: string | null;
  elements: InvitationElement[];
}): EditorDesign {
  return {
    size: sizeKeyFor(source.width, source.height),
    width: source.width,
    height: source.height,
    backgroundColor: source.backgroundColor,
    backgroundGradient: source.backgroundGradient,
    backgroundImage: source.backgroundImage,
    elements: source.elements,
  };
}
