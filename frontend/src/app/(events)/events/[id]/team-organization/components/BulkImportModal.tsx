"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ClipboardPaste,
  Check,
  X,
  AlertTriangle,
  Upload,
  Users,
  Loader2,
  UserPlus,
  ArrowLeft,
  Building2,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  TableData,
  Staff,
  StaffRole,
  DEFAULT_COLORS,
  TableGroup,
  TeamDefinition,
  GroupStaffAssignment,
} from "../types";
import { staffApi, eventExtraStaffApi } from "@/lib/api";
import { ExtraStaff } from "../hooks/useOrganizationData";

// ==================== TYPES ====================

type ImportCategory =
  | "personel"
  | "loca-personeli"
  | "destek-personeli"
  | "ekstra-personel";
type ModalStep = "category" | "unit-select" | "paste" | "preview" | "done";
type DestekBirim = "royal-premium" | "crystal";

interface ParsedRow {
  staffName: string;
  position: string;
  tableNumbers: string[];
  shiftStart: string;
  shiftEnd: string;
  raw: string;
}

interface MatchedRow extends ParsedRow {
  matchedStaff: Staff | null;
  matchedTableIds: string[];
  unmatchedTables: string[];
  status: "ok" | "staff-not-found" | "no-tables";
  createNew?: boolean;
}

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  tables: TableData[];
  allStaff: Staff[];
  tableGroups: TableGroup[];
  eventId: string;
  onAddTableGroup: (
    name: string,
    tableIds: string[],
    color?: string,
  ) => TableGroup;
  onAddTeam: (name: string, color?: string) => TeamDefinition;
  onAssignGroupToTeam: (groupId: string, teamId: string) => void;
  onAssignStaffToGroup: (
    groupId: string,
    assignments: GroupStaffAssignment[],
  ) => void;
  onDeleteTableGroup?: (groupId: string) => void;
  onDeleteTeam?: (teamId: string) => void;
  setExtraStaffList?: React.Dispatch<React.SetStateAction<ExtraStaff[]>>;
  onStaffCreated?: () => void;
}

const CATEGORY_OPTIONS: {
  value: ImportCategory;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "personel",
    label: "Personel",
    desc: "Bulunamayanlar için yeni kayıt oluşturulabilir",
    icon: <Users className="w-5 h-5" />,
  },
  {
    value: "loca-personeli",
    label: "Loca Personeli",
    desc: "Bulunamayanlar için yeni kayıt oluşturulabilir",
    icon: <Star className="w-5 h-5" />,
  },
  {
    value: "destek-personeli",
    label: "Destek Personeli",
    desc: "Birim seçerek destek personeli ata",
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    value: "ekstra-personel",
    label: "Ekstra Personel",
    desc: "Geçici/ekstra personel olarak kaydet, bulunamayanlar için yeni kayıt oluşturulabilir",
    icon: <UserPlus className="w-5 h-5" />,
  },
];

const DESTEK_BIRIMLER: { value: DestekBirim; label: string }[] = [
  { value: "royal-premium", label: "Royal Premium" },
  { value: "crystal", label: "Crystal" },
];

// ==================== HELPERS ====================

function normalizeTr(s: string): string {
  return s
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/Â/g, "A")
    .replace(/Î/g, "I")
    .replace(/Û/g, "U")
    .trim();
}

function findStaffMatch(name: string, allStaff: Staff[]): Staff | null {
  const norm = normalizeTr(name);
  if (!norm) return null;

  const exact = allStaff.find((s) => normalizeTr(s.fullName) === norm);
  if (exact) return exact;

  const contains = allStaff.find(
    (s) =>
      normalizeTr(s.fullName).includes(norm) ||
      norm.includes(normalizeTr(s.fullName)),
  );
  if (contains) return contains;

  const inputTokens = norm.split(/\s+/).filter(Boolean);
  if (inputTokens.length >= 2) {
    let bestMatch: Staff | null = null;
    let bestScore = 0;
    for (const staff of allStaff) {
      const staffTokens = normalizeTr(staff.fullName)
        .split(/\s+/)
        .filter(Boolean);
      const matchCount = inputTokens.filter((t) =>
        staffTokens.some((st) => st === t || st.includes(t) || t.includes(st)),
      ).length;
      if (matchCount >= 2 && matchCount > bestScore) {
        bestScore = matchCount;
        bestMatch = staff;
      }
    }
    if (bestMatch) return bestMatch;
  }

  if (inputTokens.length >= 2) {
    const surname = inputTokens[inputTokens.length - 1];
    const firstName = inputTokens[0];
    const surnameMatch = allStaff.find((s) => {
      const tokens = normalizeTr(s.fullName).split(/\s+/);
      return (
        tokens.some((t) => t === surname) &&
        tokens.some((t) => t === firstName || t.startsWith(firstName))
      );
    });
    if (surnameMatch) return surnameMatch;
  }

  return null;
}

function parseShiftTime(raw: string): { start: string; end: string } {
  let cleaned = raw.trim().replace(/\s+/g, "");
  cleaned = cleaned.replace(/--+/g, "-");

  const parts = cleaned.split(/(?<=\d)-(?=\d|K)/i);
  if (parts.length >= 2) {
    const start = parts[0].trim();
    let end = parts.slice(1).join("-").trim();
    if (end.toUpperCase() === "K") end = "06:00";
    return { start, end };
  }

  const timePattern = /(\d{1,2}:\d{2})/g;
  const times = cleaned.match(timePattern);
  if (times && times.length >= 2) return { start: times[0], end: times[1] };
  if (times && times.length === 1 && cleaned.toUpperCase().includes("K")) {
    return { start: times[0], end: "06:00" };
  }

  return { start: "18:00", end: "02:00" };
}

function parseClipboardData(text: string): ParsedRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: ParsedRow[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      lower.includes("personel") &&
      (lower.includes("pozisyon") ||
        lower.includes("posta") ||
        lower.includes("saat"))
    )
      continue;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) continue;

    let parts = line
      .split("\t")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 3) {
      parts = line
        .split(/\s{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
    }

    if (parts.length < 3) {
      const timeMatch = line.match(
        /(\d{1,2}:\d{2}\s*[-–]\s*(?:\d{1,2}:\d{2}|K))/i,
      );
      const tableMatch = line.match(/(\d{1,4}(?:\s*\/\s*\d{1,4})+)/);
      if (timeMatch && tableMatch) {
        const timeStr = timeMatch[0];
        const tableStr = tableMatch[0];
        const beforeTables = line.substring(0, line.indexOf(tableStr)).trim();
        const nameStr = beforeTables.replace(/\bPERSONEL\b/gi, "").trim();
        if (nameStr) {
          const shift = parseShiftTime(timeStr);
          rows.push({
            staffName: nameStr,
            position: "PERSONEL",
            tableNumbers: tableStr
              .split("/")
              .map((t) => t.trim())
              .filter(Boolean),
            shiftStart: shift.start,
            shiftEnd: shift.end,
            raw: line,
          });
          continue;
        }
      }
      continue;
    }

    let posIdx = -1,
      tableIdx = -1,
      timeIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      if (/^\d{1,4}(\/\d{1,4})+$/.test(parts[i].replace(/\s/g, "")))
        tableIdx = i;
      else if (/\d{1,2}:\d{2}/.test(parts[i])) timeIdx = i;
      else if (/^personel$/i.test(parts[i])) posIdx = i;
    }

    const nameParts: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i !== posIdx && i !== tableIdx && i !== timeIdx)
        nameParts.push(parts[i]);
    }

    const staffName = nameParts.join(" ").trim();
    const tableStr = tableIdx >= 0 ? parts[tableIdx] : "";
    const timeStr = timeIdx >= 0 ? parts[timeIdx] : "18:00-02:00";
    if (!staffName || !tableStr) continue;

    const shift = parseShiftTime(timeStr);
    rows.push({
      staffName,
      position: posIdx >= 0 ? parts[posIdx] : "PERSONEL",
      tableNumbers: tableStr
        .replace(/\s/g, "")
        .split("/")
        .map((t) => t.trim())
        .filter(Boolean),
      shiftStart: shift.start,
      shiftEnd: shift.end,
      raw: line,
    });
  }
  return rows;
}

// ==================== LOCA PERSONEL PARSER ====================

function parseLocaNumbers(locaLine: string): string[] {
  // "LOCA 1-2" → ["L1", "L2"]
  // "LOCA 3 A -- 3 B" → ["L3A", "L3B"] veya ["L3"]
  // "LOCA 4 -- 5" → ["L4", "L5"]
  // "LOCA 8A -8B" → ["L8A", "L8B"]
  // "LOCA 9 - 10" → ["L9", "L10"]

  let cleaned = locaLine.replace(/^LOCA\s*/i, "").trim();
  // Normalize dashes
  cleaned = cleaned.replace(/\s*[-–]+\s*/g, "-");

  // Try range pattern: "1-2", "4-5", "9-10"
  const rangeMatch = cleaned.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (!isNaN(start) && !isNaN(end) && end > start && end - start < 20) {
      const result: string[] = [];
      for (let i = start; i <= end; i++) result.push(`L${i}`);
      return result;
    }
    // Could be two separate locas
    return [`L${rangeMatch[1]}`, `L${rangeMatch[2]}`];
  }

  // Try alphanumeric pattern: "3 A-3 B", "8A-8B"
  const alphaMatch = cleaned.match(
    /^(\d+)\s*([A-Za-z]?)\s*-\s*(\d+)\s*([A-Za-z]?)$/,
  );
  if (alphaMatch) {
    const num1 = alphaMatch[1];
    const letter1 = alphaMatch[2]?.toUpperCase() || "";
    const num2 = alphaMatch[3];
    const letter2 = alphaMatch[4]?.toUpperCase() || "";

    if (num1 === num2 && letter1 && letter2) {
      // Same number, different letters: "3A-3B" → ["L3A", "L3B"]
      return [`L${num1}${letter1}`, `L${num2}${letter2}`];
    }
    // Different numbers
    const labels: string[] = [];
    labels.push(`L${num1}${letter1}`);
    labels.push(`L${num2}${letter2}`);
    return labels;
  }

  // Single loca: "1", "3A"
  const singleMatch = cleaned.match(/^(\d+)\s*([A-Za-z]?)$/);
  if (singleMatch) {
    return [`L${singleMatch[1]}${(singleMatch[2] || "").toUpperCase()}`];
  }

  // Fallback: just prefix with L
  return [`L${cleaned.replace(/\s/g, "")}`];
}

function parseLocaClipboardData(text: string): ParsedRow[] {
  // Pre-process: LOCA headers might not be on separate lines.
  // Insert newline before each "LOCA" keyword that appears mid-text
  // Also insert newline before time patterns that are followed by a name (staff boundary)
  let normalized = text;

  // Insert newline before "LOCA" when preceded by non-whitespace (e.g., "19:00-KLOCA")
  normalized = normalized.replace(/(?<=\S)(LOCA\s)/gi, "\n$1");

  // Split by newlines first
  let lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // For each line, try to split further if it contains multiple staff entries
  // Pattern: after a time+end (e.g., "00:00" or "K"), a new name starts with uppercase letters
  const expandedLines: string[] = [];
  for (const line of lines) {
    // If this is a LOCA header line, keep as-is
    if (/^LOCA\s/i.test(line)) {
      expandedLines.push(line);
      continue;
    }

    // Split on boundaries where a time ending is followed by a name
    // e.g., "20:00--00:00TUĞBA ILBAY\t19:00-K" → ["20:00--00:00", "TUĞBA ILBAY\t19:00-K"]
    // We look for: (time-end)(start-of-name)
    // Time ends with: HH:MM or K
    // Name starts with: Turkish uppercase letter
    const parts = line.split(
      /(?<=\d{1,2}:\d{2}|(?<=[-–])K)(?=[A-ZÇĞİÖŞÜa-zçğıöşü]{2})/,
    );

    if (parts.length > 1) {
      // First part might be just a time (belongs to previous) or name+time
      // Check each part
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) expandedLines.push(trimmed);
      }
    } else {
      expandedLines.push(line);
    }
  }

  // Now further split tab-separated entries within each line
  // Some lines may contain: "NAME\tTIME" or "LOCA X\tNAME\tTIME..."
  const finalLines: string[] = [];
  for (const line of expandedLines) {
    if (/^LOCA\s/i.test(line)) {
      // LOCA header might have staff data after tab: "LOCA 1-2\tHANDE KAYHAN\t20:00--00:00"
      const tabParts = line
        .split("\t")
        .map((p) => p.trim())
        .filter(Boolean);
      if (tabParts.length > 1) {
        // First part is LOCA header
        finalLines.push(tabParts[0]);
        // Remaining parts are staff data - rejoin with tab
        finalLines.push(tabParts.slice(1).join("\t"));
      } else {
        finalLines.push(line);
      }
    } else {
      finalLines.push(line);
    }
  }

  // Final pass: split lines that contain multiple staff entries glued together
  // e.g., "HANDE KAYHAN\t20:00--00:00TUĞBA ILBAY\t19:00-K"
  // Pattern: time ending (HH:MM or K) immediately followed by a letter (start of next name)
  const splitLines: string[] = [];
  for (const line of finalLines) {
    if (/^LOCA\s/i.test(line)) {
      splitLines.push(line);
      continue;
    }
    // Split where a time ends and a new name begins
    const parts = line.split(
      /(?<=\d{2}:\d{2})(?=[A-ZÇĞİÖŞÜ])|(?<=[-–]K)(?=[A-ZÇĞİÖŞÜ])/,
    );
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) splitLines.push(trimmed);
    }
  }

  const rows: ParsedRow[] = [];
  let currentLocas: string[] = [];

  for (const line of splitLines) {
    // Skip header lines
    const lower = line.toLowerCase();
    if (
      lower.includes("personel") &&
      (lower.includes("pozisyon") || lower.includes("posta"))
    )
      continue;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) continue;

    // Check if this is a LOCA header line
    if (/^LOCA\s/i.test(line)) {
      currentLocas = parseLocaNumbers(line);
      continue;
    }

    // This should be a staff line: NAME + TIME (possibly tab-separated)
    // First try tab-separated: "NAME\tTIME"
    const tabParts = line
      .split("\t")
      .map((p) => p.trim())
      .filter(Boolean);
    let nameStr = "";
    let timeStr = "";

    if (tabParts.length >= 2) {
      // Last part with time pattern is the time
      for (let i = tabParts.length - 1; i >= 0; i--) {
        if (/\d{1,2}:\d{2}/.test(tabParts[i])) {
          timeStr = tabParts[i];
          nameStr = tabParts.slice(0, i).join(" ").trim();
          break;
        }
      }
    }

    // Fallback: extract time from anywhere in the line
    if (!timeStr) {
      const timeMatch = line.match(
        /(\d{1,2}:\d{2}\s*[-–]+\s*(?:\d{1,2}:\d{2}|K))/i,
      );
      if (!timeMatch) continue;
      timeStr = timeMatch[0];
      nameStr = line.substring(0, line.indexOf(timeStr)).trim();
    }

    if (!nameStr) continue;
    // Clean up name - remove tab remnants
    nameStr = nameStr.replace(/\t/g, " ").replace(/\s+/g, " ").trim();

    const shift = parseShiftTime(timeStr);

    if (currentLocas.length > 0) {
      rows.push({
        staffName: nameStr,
        position: "Loca Personeli",
        tableNumbers: [...currentLocas],
        shiftStart: shift.start,
        shiftEnd: shift.end,
        raw: line,
      });
    }
  }
  return rows;
}

export function BulkImportModal({
  open,
  onClose,
  tables,
  allStaff,
  tableGroups,
  eventId,
  onAddTableGroup,
  onAddTeam,
  onAssignGroupToTeam,
  onAssignStaffToGroup,
  onDeleteTableGroup,
  onDeleteTeam,
  setExtraStaffList,
  onStaffCreated,
}: BulkImportModalProps) {
  const [category, setCategory] = useState<ImportCategory | null>(null);
  const [destekBirim, setDestekBirim] = useState<DestekBirim | null>(null);
  const [step, setStep] = useState<ModalStep>("category");
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);

  // Table label -> id map (includes loca name variants)
  const labelToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    tables.forEach((t) => {
      map.set(t.label, t.id);
      const num = parseInt(t.label, 10);
      if (!isNaN(num)) map.set(String(num), t.id);
      // Loca variants: locaName, L+number
      if (t.isLoca) {
        if (t.locaName) {
          map.set(t.locaName, t.id);
          map.set(t.locaName.toUpperCase(), t.id);
        }
        // Ensure L-prefixed labels work: L1, L2, etc.
        if (!t.label.startsWith("L")) {
          map.set(`L${t.label}`, t.id);
        }
      }
    });
    return map;
  }, [tables]);

  // Parse and match rows
  const computeMatchedRows = useCallback(
    (text: string): MatchedRow[] => {
      if (!text.trim()) return [];
      const parsed =
        category === "loca-personeli"
          ? parseLocaClipboardData(text)
          : parseClipboardData(text);
      return parsed.map((row) => {
        const matchedStaff = findStaffMatch(row.staffName, allStaff);
        const matchedTableIds: string[] = [];
        const unmatchedTables: string[] = [];
        for (const num of row.tableNumbers) {
          const id = labelToIdMap.get(num);
          if (id) matchedTableIds.push(id);
          else unmatchedTables.push(num);
        }
        let status: MatchedRow["status"] = "ok";
        if (!matchedStaff) status = "staff-not-found";
        else if (matchedTableIds.length === 0) status = "no-tables";
        return {
          ...row,
          matchedStaff,
          matchedTableIds,
          unmatchedTables,
          status,
          createNew: false,
        };
      });
    },
    [allStaff, labelToIdMap, category],
  );

  const okRows = useMemo(
    () => matchedRows.filter((r) => r.status === "ok"),
    [matchedRows],
  );
  const notFoundRows = useMemo(
    () => matchedRows.filter((r) => r.status === "staff-not-found"),
    [matchedRows],
  );
  const noTableRows = useMemo(
    () => matchedRows.filter((r) => r.status === "no-tables"),
    [matchedRows],
  );

  // Can create new staff for all categories
  const canCreateNew = true;

  // Toggle createNew for a not-found row
  const toggleCreateNew = useCallback((idx: number) => {
    setMatchedRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        return { ...r, createNew: !r.createNew };
      }),
    );
  }, []);

  // Select all not-found for creation
  const selectAllForCreation = useCallback(() => {
    const allSelected = notFoundRows.every((r) => r.createNew);
    setMatchedRows((prev) =>
      prev.map((r) => {
        if (r.status !== "staff-not-found") return r;
        return { ...r, createNew: !allSelected };
      }),
    );
  }, [notFoundRows]);

  // Handle category select
  const handleCategorySelect = useCallback((cat: ImportCategory) => {
    setCategory(cat);
    if (cat === "destek-personeli") {
      setStep("unit-select");
    } else {
      setStep("paste");
    }
  }, []);

  // Handle birim select
  const handleBirimSelect = useCallback((birim: DestekBirim) => {
    setDestekBirim(birim);
    setStep("paste");
  }, []);

  // Paste from clipboard
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setPasteText(text);
    } catch {
      /* user can paste manually */
    }
  }, []);

  // Parse button
  const handleParse = useCallback(() => {
    if (pasteText.trim()) {
      const rows = computeMatchedRows(pasteText);
      setMatchedRows(rows);
      setStep("preview");
    }
  }, [pasteText, computeMatchedRows]);

  // Generate sicilNo
  const generateSicilNo = useCallback(() => {
    return `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }, []);

  // ==================== IMPORT LOGIC ====================

  const handleImport = useCallback(async () => {
    setImporting(true);
    let imported = 0;
    let created = 0;

    try {
      // --- EKSTRA PERSONEL ---
      if (category === "ekstra-personel") {
        // First create DB records for not-found staff marked for creation
        const toCreateExtra = matchedRows
          .map((r, i) => ({ row: r, idx: i }))
          .filter(
            ({ row }) => row.status === "staff-not-found" && row.createNew,
          );

        for (const { row } of toCreateExtra) {
          try {
            await staffApi.createPersonnel({
              sicilNo: generateSicilNo(),
              fullName: row.staffName,
              position: "Personel",
              isActive: true,
            });
            created++;
            // Rate limit koruması
            await new Promise((r) => setTimeout(r, 200));
          } catch (err) {
            console.error(`Failed to create staff: ${row.staffName}`, err);
          }
        }

        const extraStaffItems: ExtraStaff[] = matchedRows.map((row, i) => ({
          id: `extra-${Date.now()}-${i}`,
          fullName: row.staffName,
          position: row.position || "Ekstra Personel",
          role: "waiter",
          shiftStart: row.shiftStart,
          shiftEnd: row.shiftEnd,
          color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
          assignedTables: row.tableNumbers,
          isActive: true,
        }));

        // Save to backend
        try {
          await eventExtraStaffApi.saveBulk(
            eventId,
            extraStaffItems.map((es) => ({
              fullName: es.fullName,
              position: es.position,
              role: es.role,
              shiftStart: es.shiftStart,
              shiftEnd: es.shiftEnd,
              color: es.color,
              assignedTables: es.assignedTables,
            })),
          );
        } catch (err) {
          console.error("Extra staff bulk save error:", err);
        }

        // Update local state
        if (setExtraStaffList) {
          setExtraStaffList((prev) => [...prev, ...extraStaffItems]);
        }
        imported = extraStaffItems.length;
        setImportedCount(imported);
        setCreatedCount(created);
        if (created > 0 && onStaffCreated) {
          onStaffCreated();
        }
        setStep("done");
        return;
      }

      // --- PERSONEL / LOCA / DESTEK ---
      // Step 1: Create new staff records for not-found rows (personel & loca only)
      const newStaffMap = new Map<number, Staff>(); // row index -> created staff

      if (canCreateNew) {
        const toCreate = matchedRows
          .map((r, i) => ({ row: r, idx: i }))
          .filter(
            ({ row }) => row.status === "staff-not-found" && row.createNew,
          );

        for (const { row, idx } of toCreate) {
          try {
            const workLocation =
              category === "loca-personeli"
                ? "Loca"
                : (category as ImportCategory) === "destek-personeli" &&
                    destekBirim
                  ? destekBirim === "royal-premium"
                    ? "Royal Premium"
                    : "Crystal"
                  : undefined;

            const res = await staffApi.createPersonnel({
              sicilNo: generateSicilNo(),
              fullName: row.staffName,
              position: "Personel",
              workLocation,
              isActive: true,
            });

            if (res.data) {
              const newStaff: Staff = {
                id: res.data.id,
                fullName: res.data.fullName || row.staffName,
                email: res.data.email || "",
                color:
                  res.data.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
                isActive: true,
                position: res.data.position,
                workLocation: res.data.workLocation,
              };
              newStaffMap.set(idx, newStaff);
              created++;
              // Rate limit koruması - 429 hatalarını önle
              await new Promise((r) => setTimeout(r, 200));
            }
          } catch (err) {
            console.error(`Failed to create staff: ${row.staffName}`, err);
          }
        }
      }

      // Step 2: Import all importable rows
      for (let i = 0; i < matchedRows.length; i++) {
        const row = matchedRows[i];
        let staff: Staff | null = row.matchedStaff;

        // Check if we created this staff
        if (!staff && newStaffMap.has(i)) {
          staff = newStaffMap.get(i)!;
        }

        if (!staff) continue;

        // Resolve table IDs
        const tableIds =
          row.matchedTableIds.length > 0
            ? row.matchedTableIds
            : row.tableNumbers
                .map((n) => labelToIdMap.get(n))
                .filter((id): id is string => !!id);

        if (tableIds.length === 0) continue;

        const color =
          DEFAULT_COLORS[
            (tableGroups.length + imported) % DEFAULT_COLORS.length
          ];

        // Create group with actual table IDs (not labels)
        const newGroup = onAddTableGroup(
          `${staff.fullName} Masaları`,
          tableIds,
          color,
        );
        // Create hidden team
        const newTeam = onAddTeam(staff.fullName, color);
        // Assign group to team
        onAssignGroupToTeam(newGroup.id, newTeam.id);
        // Create staff assignment
        const assignment: GroupStaffAssignment = {
          id: `sa-bulk-${Date.now()}-${imported}-${Math.random().toString(36).slice(2, 9)}`,
          staffId: staff.id,
          staffName: staff.fullName,
          role: "waiter" as StaffRole,
          shiftStart: row.shiftStart,
          shiftEnd: row.shiftEnd,
        };
        onAssignStaffToGroup(newGroup.id, [assignment]);
        imported++;
      }

      // Notify parent to refresh staff list if new records created
      if (created > 0 && onStaffCreated) {
        onStaffCreated();
      }

      setImportedCount(imported);
      setCreatedCount(created);
      setStep("done");
    } catch (err) {
      console.error("Import error:", err);
    } finally {
      setImporting(false);
    }
  }, [
    category,
    matchedRows,
    canCreateNew,
    destekBirim,
    eventId,
    labelToIdMap,
    tableGroups.length,
    tables,
    onAddTableGroup,
    onAddTeam,
    onAssignGroupToTeam,
    onAssignStaffToGroup,
    setExtraStaffList,
    onStaffCreated,
    generateSicilNo,
  ]);

  // Reset
  const handleReset = useCallback(() => {
    setPasteText("");
    setStep("category");
    setCategory(null);
    setDestekBirim(null);
    setImportedCount(0);
    setCreatedCount(0);
    setMatchedRows([]);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const getCategoryLabel = () =>
    CATEGORY_OPTIONS.find((c) => c.value === category)?.label || "";

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-emerald-400" />
            Toplu Personel İçe Aktarma
            {category && step !== "category" && (
              <Badge className="ml-2 bg-blue-600/20 text-blue-300 text-xs">
                {getCategoryLabel()}
              </Badge>
            )}
            {destekBirim && (
              <Badge className="bg-purple-600/20 text-purple-300 text-xs">
                {DESTEK_BIRIMLER.find((b) => b.value === destekBirim)?.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {/* STEP: Category Selection */}
          {step === "category" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Hangi türde personel aktarımı yapmak istiyorsunuz?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleCategorySelect(opt.value)}
                    className="flex items-start gap-3 p-4 rounded-lg border border-slate-600 bg-slate-900/50 hover:bg-slate-700/50 hover:border-blue-500/50 transition-all text-left group"
                  >
                    <div className="p-2 rounded-lg bg-slate-700 text-blue-400 group-hover:bg-blue-600/20 transition-colors">
                      {opt.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {opt.label}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP: Unit Selection (Destek only) */}
          {step === "unit-select" && (
            <div className="space-y-3">
              <button
                onClick={() => setStep("category")}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Geri
              </button>
              <p className="text-sm text-slate-400">
                Hangi birimden destek personeli atanacak?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {DESTEK_BIRIMLER.map((birim) => (
                  <button
                    key={birim.value}
                    onClick={() => handleBirimSelect(birim.value)}
                    className="flex items-center gap-3 p-4 rounded-lg border border-slate-600 bg-slate-900/50 hover:bg-slate-700/50 hover:border-purple-500/50 transition-all text-left"
                  >
                    <Building2 className="w-5 h-5 text-purple-400" />
                    <span className="text-sm font-medium text-white">
                      {birim.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP: Paste */}
          {step === "paste" && (
            <div className="space-y-4">
              <button
                onClick={() => {
                  if (category === "destek-personeli") setStep("unit-select");
                  else setStep("category");
                }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Geri
              </button>
              <p className="text-sm text-slate-400">
                {category === "loca-personeli"
                  ? "Loca personel listesini kopyalayıp yapıştırın. Her loca başlığının altına personelleri yazın."
                  : "Personel listesini kopyalayıp yapıştırın. Format: İSİM  POZİSYON  MASALAR  SAAT"}
              </p>
              <div className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-500 font-mono whitespace-pre-line">
                {category === "loca-personeli" ? (
                  <>
                    LOCA 1-2
                    <br />
                    HANDE KAYHAN 20:00--00:00
                    <br />
                    TUĞBA ILBAY 19:00-K
                    <br />
                    LOCA 3 A -- 3 B
                    <br />
                    İLAYDA ZİREK 19:00-K
                    <br />
                    BUSE OKUR 19:00--00:00
                  </>
                ) : (
                  <>
                    MEHMET KOCAK &nbsp; PERSONEL &nbsp; 38/39/52/53 &nbsp;
                    20:00-00:00
                    <br />
                    AZİZ DEMHAT &nbsp; PERSONEL &nbsp; 54/65/66/67 &nbsp;
                    12:00-K
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handlePasteFromClipboard}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <ClipboardPaste className="w-4 h-4 mr-1" /> Panodan Yapıştır
                </Button>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Veriyi buraya yapıştırın..."
                className="w-full h-48 bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-white font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                spellCheck={false}
              />
              {pasteText.trim() && (
                <Button
                  onClick={handleParse}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Verileri Analiz Et
                </Button>
              )}
            </div>
          )}

          {/* STEP: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <button
                onClick={() => setStep("paste")}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Geri
              </button>

              {/* Summary cards */}
              <div className="flex gap-3">
                <div className="flex-1 bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-400">
                    {okRows.length}
                  </div>
                  <div className="text-xs text-emerald-300">Hazır</div>
                </div>
                {notFoundRows.length > 0 && (
                  <div className="flex-1 bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-400">
                      {notFoundRows.length}
                    </div>
                    <div className="text-xs text-amber-300">Bulunamadı</div>
                  </div>
                )}
                <div className="flex-1 bg-slate-700/30 border border-slate-600 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-slate-300">
                    {matchedRows.length}
                  </div>
                  <div className="text-xs text-slate-400">Toplam</div>
                </div>
              </div>

              {/* Not found rows - with create option for personel/loca */}
              {notFoundRows.length > 0 && (
                <div className="bg-amber-900/10 border border-amber-700/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      Veritabanında Bulunamayan Personeller
                    </div>
                    {canCreateNew && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={selectAllForCreation}
                        className="h-6 text-[10px] border-amber-600 text-amber-300 hover:bg-amber-900/30"
                      >
                        {notFoundRows.every((r) => r.createNew)
                          ? "Tümünü Kaldır"
                          : "Tümünü Seç"}
                      </Button>
                    )}
                  </div>

                  {canCreateNew && (
                    <p className="text-xs text-amber-300/70 mb-2">
                      Seçilen personeller için veritabanında yeni kayıt
                      oluşturulacak
                    </p>
                  )}

                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {matchedRows.map((row, idx) => {
                      if (row.status !== "staff-not-found") return null;
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs text-amber-300/80"
                        >
                          {canCreateNew ? (
                            <button
                              onClick={() => toggleCreateNew(idx)}
                              className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                row.createNew
                                  ? "bg-emerald-600 border-emerald-500"
                                  : "border-amber-600 hover:border-amber-400"
                              }`}
                            >
                              {row.createNew && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </button>
                          ) : (
                            <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                          )}
                          <span className="font-medium">{row.staffName}</span>
                          <span className="text-slate-500">
                            {row.tableNumbers.join("/")}
                          </span>
                          <span className="text-slate-500">
                            {row.shiftStart}-{row.shiftEnd}
                          </span>
                          {canCreateNew && row.createNew && (
                            <Badge className="text-[9px] bg-emerald-600/20 text-emerald-300">
                              Yeni Kayıt
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* OK rows table */}
              {okRows.length > 0 && (
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-700/50 px-3 py-2 text-xs font-medium text-slate-300 grid grid-cols-12 gap-2">
                    <div className="col-span-3">Personel</div>
                    <div className="col-span-3">Eşleşen</div>
                    <div className="col-span-3">Masalar</div>
                    <div className="col-span-2">Saat</div>
                    <div className="col-span-1">Durum</div>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-700/50">
                    {okRows.map((row, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 text-xs grid grid-cols-12 gap-2 items-center"
                      >
                        <div className="col-span-3 text-white truncate">
                          {row.staffName}
                        </div>
                        <div className="col-span-3 text-emerald-400 truncate">
                          {row.matchedStaff?.fullName}
                        </div>
                        <div className="col-span-3 text-slate-300">
                          {row.tableNumbers.join("/")}
                        </div>
                        <div className="col-span-2 text-slate-400">
                          {row.shiftStart}-{row.shiftEnd}
                        </div>
                        <div className="col-span-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Import button */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("paste")}
                  className="border-slate-600 text-slate-300"
                >
                  Geri Dön
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={
                    importing ||
                    (okRows.length === 0 &&
                      !matchedRows.some((r) => r.createNew))
                  }
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" /> İçe
                      Aktarılıyor...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-1" />{" "}
                      {okRows.length +
                        matchedRows.filter((r) => r.createNew).length}{" "}
                      Personel Aktar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP: Done */}
          {step === "done" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  İçe Aktarma Tamamlandı
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {importedCount} personel başarıyla aktarıldı
                  {createdCount > 0 &&
                    `, ${createdCount} yeni kayıt oluşturuldu`}
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="border-slate-600 text-slate-300"
                >
                  Yeni İçe Aktarma
                </Button>
                <Button
                  onClick={handleClose}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Kapat
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-700 pt-3">
          {step === "category" && (
            <Button
              variant="outline"
              onClick={handleClose}
              className="border-slate-600 text-slate-300"
            >
              İptal
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
