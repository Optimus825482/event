"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { X, Search, Clock, Check, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TableData, TableGroup, Staff } from "../types";
import { positionsApi } from "@/lib/api";

interface StaffAssignmentModalProps {
  tables: TableData[];
  tableGroups: TableGroup[];
  allStaff: Staff[];
  onSave: (data: {
    staffId: string;
    staffName: string;
    position: string;
    tableIds: string[];
    shiftStart: string;
    shiftEnd: string;
  }) => void;
  onClose: () => void;
}

interface PositionOption {
  id: string;
  name: string;
}

export function StaffAssignmentModal({
  tables,
  tableGroups,
  allStaff,
  onSave,
  onClose,
}: StaffAssignmentModalProps) {
  // Form state
  const [staffSearch, setStaffSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedPosition, setSelectedPosition] = useState("");
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [shiftStart, setShiftStart] = useState("18:00");
  const [shiftEnd, setShiftEnd] = useState("02:00");
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [tableSearch, setTableSearch] = useState("");

  const searchRef = useRef<HTMLDivElement>(null);

  // Pozisyonları DB'den yükle
  useEffect(() => {
    positionsApi
      .getAll()
      .then((res) => {
        setPositions(
          (res.data || []).map((p: any) => ({ id: p.id, name: p.name })),
        );
      })
      .catch(() => {
        // Fallback pozisyonlar
        setPositions([
          { id: "1", name: "Garson" },
          { id: "2", name: "Kaptan" },
          { id: "3", name: "Süpervizör" },
          { id: "4", name: "Komi" },
          { id: "5", name: "Barmen" },
          { id: "6", name: "Hostes" },
        ]);
      });
  }, []);

  // Dışarı tıklayınca dropdown kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowStaffDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Personel arama sonuçları
  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return allStaff.filter((s) => s.isActive);
    const q = staffSearch.toLowerCase();
    return allStaff.filter(
      (s) =>
        s.isActive &&
        (s.fullName.toLowerCase().includes(q) ||
          s.position?.toLowerCase().includes(q) ||
          s.department?.toLowerCase().includes(q)),
    );
  }, [allStaff, staffSearch]);

  // Masa arama/filtreleme
  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return tables;
    const q = tableSearch.toLowerCase();
    return tables.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.typeName?.toLowerCase().includes(q) ||
        t.locaName?.toLowerCase().includes(q),
    );
  }, [tables, tableSearch]);

  // Zaten atanmış masaları bul
  const assignedTableIds = useMemo(() => {
    const ids = new Set<string>();
    tableGroups.forEach((g) => {
      if ((g.staffAssignments?.length || 0) > 0) {
        g.tableIds.forEach((tid) => ids.add(tid));
      }
    });
    return ids;
  }, [tableGroups]);

  // Personel seçildiğinde pozisyonu otomatik doldur
  const handleSelectStaff = (staff: Staff) => {
    setSelectedStaff(staff);
    setStaffSearch(staff.fullName);
    setShowStaffDropdown(false);

    // Pozisyonu otomatik doldur
    if (staff.position) {
      // DB'deki pozisyon adıyla eşleştir
      const matchedPosition = positions.find(
        (p) => p.name.toLowerCase() === staff.position?.toLowerCase(),
      );
      setSelectedPosition(matchedPosition?.name || staff.position);
    }
  };

  // Masa seçim toggle
  const toggleTable = (tableId: string) => {
    setSelectedTableIds((prev) =>
      prev.includes(tableId)
        ? prev.filter((id) => id !== tableId)
        : [...prev, tableId],
    );
  };

  // Tümünü seç/kaldır
  const toggleAllTables = () => {
    if (selectedTableIds.length === filteredTables.length) {
      setSelectedTableIds([]);
    } else {
      setSelectedTableIds(filteredTables.map((t) => t.id));
    }
  };

  // Kaydet
  const handleSave = () => {
    if (!selectedStaff || selectedTableIds.length === 0 || !selectedPosition)
      return;

    onSave({
      staffId: selectedStaff.id,
      staffName: selectedStaff.fullName,
      position: selectedPosition,
      tableIds: selectedTableIds,
      shiftStart,
      shiftEnd,
    });

    // Formu sıfırla (modal açık kalır, sonraki personel için)
    setSelectedStaff(null);
    setStaffSearch("");
    setSelectedPosition("");
    setSelectedTableIds([]);
    setShiftStart("18:00");
    setShiftEnd("02:00");
  };

  const canSave =
    selectedStaff && selectedTableIds.length > 0 && selectedPosition;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Personel Ata</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. Personel Arama */}
          <div ref={searchRef} className="relative">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Personel
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={staffSearch}
                onChange={(e) => {
                  setStaffSearch(e.target.value);
                  setShowStaffDropdown(true);
                  if (
                    selectedStaff &&
                    e.target.value !== selectedStaff.fullName
                  ) {
                    setSelectedStaff(null);
                    setSelectedPosition("");
                  }
                }}
                onFocus={() => setShowStaffDropdown(true)}
                placeholder="İsim, pozisyon veya departman ile ara..."
                className="pl-9 bg-slate-900 border-slate-600 text-white"
              />
            </div>

            {/* Dropdown */}
            {showStaffDropdown && !selectedStaff && (
              <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-600 rounded-lg max-h-48 overflow-y-auto shadow-xl">
                {filteredStaff.length === 0 ? (
                  <div className="p-3 text-sm text-slate-500 text-center">
                    Sonuç bulunamadı
                  </div>
                ) : (
                  filteredStaff.slice(0, 20).map((staff) => (
                    <button
                      key={staff.id}
                      onClick={() => handleSelectStaff(staff)}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-800 transition-colors text-left"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                        style={{ backgroundColor: staff.color || "#6366f1" }}
                      >
                        {staff.fullName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {staff.fullName}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {staff.position || "Pozisyon belirtilmemiş"}
                          {staff.department ? ` • ${staff.department}` : ""}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 2. Görev/Pozisyon Seçimi */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Görev
            </label>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Görev seçin...</option>
              {positions.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Masa Seçimi (Multi-select) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-300">
                Masalar ({selectedTableIds.length} seçili)
              </label>
              <button
                onClick={toggleAllTables}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {selectedTableIds.length === filteredTables.length
                  ? "Tümünü Kaldır"
                  : "Tümünü Seç"}
              </button>
            </div>
            <Input
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Masa ara..."
              className="mb-2 bg-slate-900 border-slate-600 text-white text-sm"
            />
            <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-900 border border-slate-600 rounded-lg">
              {filteredTables.map((table) => {
                const isSelected = selectedTableIds.includes(table.id);
                const isAssigned = assignedTableIds.has(table.id);

                return (
                  <button
                    key={table.id}
                    onClick={() => toggleTable(table.id)}
                    className={`
                      relative px-2 py-1.5 rounded text-xs font-medium transition-all
                      ${
                        isSelected
                          ? "bg-blue-600 text-white ring-2 ring-blue-400"
                          : isAssigned
                            ? "bg-amber-900/30 text-amber-400 border border-amber-700/50"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }
                    `}
                    title={
                      isAssigned && !isSelected
                        ? "Bu masa başka bir personele atanmış"
                        : table.typeName || ""
                    }
                  >
                    {table.label}
                    {isSelected && (
                      <Check className="absolute -top-1 -right-1 w-3 h-3 text-white bg-blue-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Vardiya Saatleri */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                Başlangıç
              </label>
              <Input
                type="time"
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                Bitiş
              </label>
              <Input
                type="time"
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>
          </div>

          {/* Seçili personel özeti */}
          {selectedStaff && (
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-blue-300">
                <User className="w-4 h-4" />
                <span className="font-medium">{selectedStaff.fullName}</span>
                {selectedPosition && (
                  <span className="text-blue-400">• {selectedPosition}</span>
                )}
              </div>
              {selectedTableIds.length > 0 && (
                <div className="text-xs text-blue-400 mt-1">
                  {selectedTableIds.length} masa seçili • {shiftStart} -{" "}
                  {shiftEnd}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600"
          >
            Kapat
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            Kaydet ve Devam Et
          </Button>
        </div>
      </div>
    </div>
  );
}
