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
import type { AreaEditState, StageElement } from "../types";
import {
  AREA_COLORS,
  AREA_ICONS,
  SIZE_OPTIONS,
  FONT_OPTIONS,
  BORDER_WIDTH_OPTIONS,
  BORDER_COLORS,
  TEXT_DIRECTION_OPTIONS,
} from "../constants";

interface EditModalProps {
  areaEdit: AreaEditState;
  setAreaEdit: React.Dispatch<React.SetStateAction<AreaEditState>>;
  stageElements: StageElement[];
  onSave: () => void;
}

export function EditModal({
  areaEdit,
  setAreaEdit,
  stageElements,
  onSave,
}: EditModalProps) {
  const currentStage = stageElements.find((s) => s.id === areaEdit.stageId);
  const isVertical =
    areaEdit.textDirection === "vertical-down" ||
    areaEdit.textDirection === "vertical-up";
  const isVerticalUp = areaEdit.textDirection === "vertical-up";

  return (
    <Dialog
      open={areaEdit.isOpen}
      onOpenChange={(open) =>
        setAreaEdit((prev) => ({ ...prev, isOpen: open }))
      }
    >
      <DialogContent className="bg-slate-800 border-slate-700 max-w-sm p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-white text-sm">
            {currentStage?.type === "stage" ? "Sahne Düzenle" : "Alan Düzenle"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Metin + Etiket */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Metin</Label>
              <Input
                value={areaEdit.displayText}
                onChange={(e) =>
                  setAreaEdit((prev) => ({
                    ...prev,
                    displayText: e.target.value,
                  }))
                }
                placeholder="Kısa metin..."
                className="bg-slate-700 border-slate-600 text-white h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Etiket (tooltip)</Label>
              <Input
                value={areaEdit.label}
                onChange={(e) =>
                  setAreaEdit((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="Hover'da görünür"
                className="bg-slate-700 border-slate-600 text-white h-8 text-sm"
              />
            </div>
          </div>

          {/* Dolgu Rengi + İkon */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Dolgu Rengi</Label>
              <div className="grid grid-cols-3 gap-1">
                {AREA_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() =>
                      setAreaEdit((prev) => ({ ...prev, color: c.color }))
                    }
                    className={`w-6 h-6 rounded transition-all ${
                      areaEdit.color === c.color
                        ? "ring-2 ring-white ring-offset-1 ring-offset-slate-800"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">İkon</Label>
              <div className="grid grid-cols-4 gap-1">
                {AREA_ICONS.map((ic) => (
                  <button
                    key={ic.id}
                    onClick={() =>
                      setAreaEdit((prev) => ({ ...prev, iconId: ic.id }))
                    }
                    className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${
                      areaEdit.iconId === ic.id
                        ? "bg-slate-600 border-blue-500"
                        : "bg-slate-700 border-slate-600 hover:bg-slate-600"
                    }`}
                    title={ic.label}
                  >
                    {ic.icon ? (
                      <ic.icon className="w-3 h-3 text-white" />
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Border Rengi + Kalınlık */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Border Rengi</Label>
              <div className="grid grid-cols-4 gap-1">
                {BORDER_COLORS.slice(0, 8).map((bc) => (
                  <button
                    key={bc.id}
                    onClick={() =>
                      setAreaEdit((prev) => ({
                        ...prev,
                        borderColor: bc.color,
                      }))
                    }
                    className={`w-6 h-6 rounded border border-slate-500 transition-all ${
                      areaEdit.borderColor === bc.color
                        ? "ring-2 ring-white ring-offset-1 ring-offset-slate-800"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: bc.color }}
                    title={bc.label}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Border Kalınlığı</Label>
              <div className="flex gap-1">
                {BORDER_WIDTH_OPTIONS.map((bw) => (
                  <button
                    key={bw.id}
                    onClick={() =>
                      setAreaEdit((prev) => ({ ...prev, borderWidth: bw.id }))
                    }
                    className={`flex-1 h-6 rounded border text-xs font-medium transition-all ${
                      areaEdit.borderWidth === bw.id
                        ? "bg-slate-600 border-blue-500 text-white"
                        : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {bw.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Boyut + Yazı Tipi */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Boyut</Label>
              <div className="flex gap-1">
                {SIZE_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      setAreaEdit((prev) => ({ ...prev, fontSize: s.id }))
                    }
                    className={`flex-1 h-6 rounded border text-xs font-medium transition-all ${
                      areaEdit.fontSize === s.id
                        ? "bg-slate-600 border-blue-500 text-white"
                        : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Yazı Tipi</Label>
              <div className="flex gap-1">
                {FONT_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() =>
                      setAreaEdit((prev) => ({ ...prev, fontFamily: f.id }))
                    }
                    className={`flex-1 h-6 rounded border text-xs transition-all ${
                      f.className
                    } ${
                      areaEdit.fontFamily === f.id
                        ? "bg-slate-600 border-blue-500 text-white"
                        : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Yazı Yönü */}
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Yazı Yönü</Label>
            <div className="flex gap-2">
              {TEXT_DIRECTION_OPTIONS.map((td) => (
                <button
                  key={td.id}
                  onClick={() =>
                    setAreaEdit((prev) => ({ ...prev, textDirection: td.id }))
                  }
                  className={`flex-1 h-7 rounded border text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                    areaEdit.textDirection === td.id
                      ? "bg-slate-600 border-blue-500 text-white"
                      : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  <span>{td.icon}</span>
                  {td.label}
                </button>
              ))}
            </div>
          </div>

          {/* Önizleme */}
          <div className="flex items-center gap-2 p-2 bg-slate-900 rounded">
            <span className="text-slate-400 text-xs">Önizleme:</span>
            <div
              className={`flex-1 h-12 rounded flex items-center justify-center gap-1 text-white font-bold ${
                FONT_OPTIONS.find((f) => f.id === areaEdit.fontFamily)
                  ?.className || "font-sans"
              } ${isVertical ? "flex-col" : "flex-row"}`}
              style={{
                backgroundColor: `${areaEdit.color}cc`,
                borderColor: areaEdit.borderColor,
                borderWidth: `${areaEdit.borderWidth}px`,
                borderStyle: "solid",
              }}
              title={areaEdit.label}
            >
              {(() => {
                const iconConfig = AREA_ICONS.find(
                  (i) => i.id === areaEdit.iconId
                );
                const sizeConfig =
                  SIZE_OPTIONS.find((s) => s.id === areaEdit.fontSize) ||
                  SIZE_OPTIONS[1];
                const IconComp = iconConfig?.icon;
                return IconComp ? (
                  <IconComp className={sizeConfig.iconClass} />
                ) : null;
              })()}
              <span
                className={
                  SIZE_OPTIONS.find((s) => s.id === areaEdit.fontSize)
                    ?.textClass || "text-xs"
                }
                style={
                  isVertical
                    ? {
                        writingMode: "vertical-rl",
                        textOrientation: "mixed",
                        transform: isVerticalUp ? "rotate(180deg)" : undefined,
                      }
                    : undefined
                }
              >
                {areaEdit.displayText || ""}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAreaEdit((prev) => ({ ...prev, isOpen: false }))}
          >
            İptal
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
