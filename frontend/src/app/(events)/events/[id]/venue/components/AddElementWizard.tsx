"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Circle,
  Square,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import type { AddElementWizardState, TableType } from "../types";
import {
  TABLE_TYPE_CONFIG,
  CAPACITY_OPTIONS,
  MAX_TABLE_COUNT,
} from "../constants";

// Kat seçenekleri
const FLOOR_OPTIONS = [
  { value: 1, label: "Zemin Kat", description: "Ana salon seviyesi" },
  { value: 2, label: "2. Kat", description: "Balkon / Galeri" },
  { value: 3, label: "3. Kat", description: "Üst balkon" },
];

interface AddElementWizardProps {
  wizard: AddElementWizardState;
  setWizard: React.Dispatch<React.SetStateAction<AddElementWizardState>>;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function AddElementWizard({
  wizard,
  setWizard,
  onNext,
  onPrev,
  onSubmit,
  onClose,
}: AddElementWizardProps) {
  const isLoca = wizard.elementType === "loca";
  // Loca: Adet -> Kat -> Kapasite (3 adım)
  // Masa: Adet -> Tip -> Kapasite (3 adım)
  const totalSteps = 3;

  const handleCountChange = (value: string) => {
    const num = parseInt(value) || 1;
    setWizard((prev) => ({
      ...prev,
      count: Math.max(1, Math.min(MAX_TABLE_COUNT, num)),
    }));
  };

  const handleTypeSelect = (type: TableType) => {
    setWizard((prev) => ({ ...prev, tableType: type }));
  };

  const handleCapacitySelect = (capacity: number) => {
    setWizard((prev) => ({ ...prev, capacity }));
  };

  const handleFloorSelect = (floor: number) => {
    setWizard((prev) => ({ ...prev, floor }));
  };

  const canProceed = () => {
    if (wizard.step === 1) return wizard.count > 0;
    if (wizard.step === 2) {
      if (isLoca) return wizard.floor > 0;
      return !!wizard.tableType;
    }
    return wizard.capacity > 0;
  };

  const handleNext = () => {
    onNext();
  };

  const handlePrev = () => {
    onPrev();
  };

  const isLastStep = wizard.step === 3;

  return (
    <Dialog open={wizard.isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-sm p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-white text-sm flex items-center gap-2">
            {isLoca ? (
              <Square className="w-5 h-5 text-pink-400" />
            ) : (
              <Circle className="w-5 h-5 text-blue-400" />
            )}
            {isLoca ? "Loca Ekle" : "Masa Ekle"}
            <span className="text-slate-400 text-xs ml-auto">
              Adım {wizard.step}/{totalSteps}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Step 1: Adet */}
          {wizard.step === 1 && (
            <div className="space-y-3">
              <Label className="text-slate-300 text-sm">
                Kaç adet {isLoca ? "loca" : "masa"} eklemek istiyorsunuz?
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCountChange(String(wizard.count - 1))}
                  disabled={wizard.count <= 1}
                  className="h-10 w-10"
                >
                  -
                </Button>
                <Input
                  type="number"
                  value={wizard.count}
                  onChange={(e) => handleCountChange(e.target.value)}
                  min={1}
                  max={MAX_TABLE_COUNT}
                  className="bg-slate-700 border-slate-600 text-white text-center text-lg h-10 w-20"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCountChange(String(wizard.count + 1))}
                  disabled={wizard.count >= MAX_TABLE_COUNT}
                  className="h-10 w-10"
                >
                  +
                </Button>
              </div>
              <p className="text-slate-500 text-xs">
                1. satırdan başlayarak yerleştirilecek (max {MAX_TABLE_COUNT})
              </p>
            </div>
          )}

          {/* Step 2: Tip (masa) veya Kat (loca) */}
          {wizard.step === 2 && !isLoca && (
            <div className="space-y-3">
              <Label className="text-slate-300 text-sm">
                Masa tipini seçin
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(["standard", "premium", "vip"] as TableType[]).map((type) => {
                  const config = TABLE_TYPE_CONFIG[type];
                  return (
                    <button
                      key={type}
                      onClick={() => handleTypeSelect(type)}
                      className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                        wizard.tableType === type
                          ? "border-blue-500 bg-slate-700"
                          : "border-slate-600 bg-slate-800 hover:bg-slate-700"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: config.color }}
                      >
                        <config.icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-white text-xs font-medium">
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Kat seçimi (sadece loca için) */}
          {wizard.step === 2 && isLoca && (
            <div className="space-y-3">
              <Label className="text-slate-300 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Localar hangi katta?
              </Label>
              <div className="space-y-2">
                {FLOOR_OPTIONS.map((floor) => (
                  <button
                    key={floor.value}
                    onClick={() => handleFloorSelect(floor.value)}
                    className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                      wizard.floor === floor.value
                        ? "border-pink-500 bg-slate-700"
                        : "border-slate-600 bg-slate-800 hover:bg-slate-700"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                        wizard.floor === floor.value
                          ? "bg-pink-500 text-white"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {floor.value}
                    </div>
                    <div className="text-left">
                      <span className="text-white text-sm font-medium block">
                        {floor.label}
                      </span>
                      <span className="text-slate-400 text-xs">
                        {floor.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-slate-500 text-xs mt-2">
                💡 3D görünümde localar seçilen kata göre yükseklikte gösterilir
              </p>
            </div>
          )}

          {/* Step 3: Kapasite */}
          {wizard.step === 3 && (
            <div className="space-y-3">
              <Label className="text-slate-300 text-sm">
                Her {isLoca ? "loca" : "masa"} kaç kişilik?
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {CAPACITY_OPTIONS.map((cap) => (
                  <button
                    key={cap}
                    onClick={() => handleCapacitySelect(cap)}
                    className={`p-2 rounded-lg border-2 transition-all ${
                      wizard.capacity === cap
                        ? "border-blue-500 bg-slate-700 text-white"
                        : "border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <span className="text-lg font-bold">{cap}</span>
                    <span className="text-xs block">kişi</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-slate-400 text-xs">Özel:</Label>
                <Input
                  type="number"
                  value={wizard.capacity}
                  onChange={(e) =>
                    handleCapacitySelect(parseInt(e.target.value) || 1)
                  }
                  min={1}
                  max={100}
                  className="bg-slate-700 border-slate-600 text-white h-8 w-20 text-sm"
                />
              </div>

              {/* Özet */}
              <div className="mt-4 p-3 bg-slate-900 rounded-lg">
                <p className="text-slate-300 text-sm font-medium mb-2">Özet:</p>
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  {isLoca ? (
                    <Square className="w-4 h-4 text-pink-400" />
                  ) : (
                    <Circle
                      className="w-4 h-4"
                      style={{
                        color: TABLE_TYPE_CONFIG[wizard.tableType].color,
                      }}
                    />
                  )}
                  <span>
                    {wizard.count} adet{" "}
                    {isLoca
                      ? "Loca"
                      : TABLE_TYPE_CONFIG[wizard.tableType].label}{" "}
                    {isLoca ? "" : "masa"}
                  </span>
                </div>
                {isLoca && (
                  <div className="text-slate-400 text-xs mt-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Kat:{" "}
                    <span className="text-pink-400 font-medium">
                      {FLOOR_OPTIONS.find((f) => f.value === wizard.floor)
                        ?.label || `${wizard.floor}. Kat`}
                    </span>
                  </div>
                )}
                <div className="text-slate-400 text-xs mt-1">
                  Toplam kapasite:{" "}
                  <span className="text-white font-bold">
                    {wizard.count * wizard.capacity} kişi
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          {wizard.step > 1 && (
            <Button variant="outline" size="sm" onClick={handlePrev}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Geri
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="mr-auto"
          >
            İptal
          </Button>
          {isLastStep ? (
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={!canProceed()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Ekle
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              İleri
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
