"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin,
  Users,
  Plus,
  X,
  Wine,
  Coffee,
  UserCheck,
  Star,
  Shield,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Hizmet Noktası Tipleri
export const SERVICE_POINT_TYPES = [
  { value: "bar", label: "Bar", icon: Wine, color: "#06b6d4" },
  { value: "lounge", label: "VIP Lounge", icon: Star, color: "#f59e0b" },
  { value: "reception", label: "Karşılama", icon: UserCheck, color: "#22c55e" },
  { value: "vip_area", label: "VIP Alan", icon: Sparkles, color: "#a855f7" },
  { value: "backstage", label: "Backstage", icon: Shield, color: "#6366f1" },
  { value: "other", label: "Diğer", icon: Coffee, color: "#64748b" },
];

// Personel Görevleri
export const SERVICE_POINT_ROLES = [
  { value: "barman", label: "Barmen", color: "#06b6d4" },
  { value: "hostes", label: "Hostes", color: "#ec4899" },
  { value: "garson", label: "Garson", color: "#3b82f6" },
  { value: "barboy", label: "Barboy", color: "#22c55e" },
  { value: "security", label: "Güvenlik", color: "#ef4444" },
  { value: "runner", label: "Runner", color: "#f59e0b" },
  { value: "supervisor", label: "Süpervizör", color: "#8b5cf6" },
];

export interface ServicePointData {
  id?: string;
  name: string;
  pointType: string;
  requiredStaffCount: number;
  allowedRoles: string[];
  color: string;
  description?: string;
}

interface ServicePointModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ServicePointData) => void;
  initialData?: ServicePointData | null;
  mode?: "create" | "edit";
}

export function ServicePointModal({
  open,
  onOpenChange,
  onSave,
  initialData,
  mode = "create",
}: ServicePointModalProps) {
  const [name, setName] = useState("");
  const [pointType, setPointType] = useState("bar");
  const [requiredStaffCount, setRequiredStaffCount] = useState(1);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([
    "barman",
    "garson",
  ]);
  const [color, setColor] = useState("#06b6d4");
  const [description, setDescription] = useState("");

  // Initial data yükle
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPointType(initialData.pointType);
      setRequiredStaffCount(initialData.requiredStaffCount);
      setAllowedRoles(initialData.allowedRoles);
      setColor(initialData.color);
      setDescription(initialData.description || "");
    } else {
      // Reset form
      setName("");
      setPointType("bar");
      setRequiredStaffCount(1);
      setAllowedRoles(["barman", "garson"]);
      setColor("#06b6d4");
      setDescription("");
    }
  }, [initialData, open]);

  // Tip değiştiğinde rengi güncelle
  useEffect(() => {
    const typeConfig = SERVICE_POINT_TYPES.find((t) => t.value === pointType);
    if (typeConfig && !initialData) {
      setColor(typeConfig.color);
    }
  }, [pointType, initialData]);

  const handleRoleToggle = (role: string) => {
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;

    onSave({
      id: initialData?.id,
      name: name.trim(),
      pointType,
      requiredStaffCount,
      allowedRoles,
      color,
      description: description.trim() || undefined,
    });

    onOpenChange(false);
  };

  const selectedType = SERVICE_POINT_TYPES.find((t) => t.value === pointType);
  const TypeIcon = selectedType?.icon || MapPin;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}20` }}
            >
              <TypeIcon className="w-4 h-4" style={{ color }} />
            </div>
            {mode === "create"
              ? "Hizmet Noktası Ekle"
              : "Hizmet Noktası Düzenle"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Etkinlik alanı dışındaki bar, lounge veya karşılama noktası ekleyin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* İsim */}
          <div className="space-y-2">
            <Label className="text-slate-300">Nokta Adı</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Ana Bar, VIP Lounge, Giriş Karşılama"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>

          {/* Tip Seçimi */}
          <div className="space-y-2">
            <Label className="text-slate-300">Nokta Tipi</Label>
            <Select value={pointType} onValueChange={setPointType}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {SERVICE_POINT_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem
                      key={type.value}
                      value={type.value}
                      className="text-slate-200 focus:bg-slate-700"
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className="w-4 h-4"
                          style={{ color: type.color }}
                        />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Gerekli Personel Sayısı */}
          <div className="space-y-2">
            <Label className="text-slate-300">Gerekli Personel Sayısı</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 border-slate-600"
                onClick={() =>
                  setRequiredStaffCount(Math.max(1, requiredStaffCount - 1))
                }
              >
                -
              </Button>
              <Input
                type="number"
                value={requiredStaffCount}
                onChange={(e) =>
                  setRequiredStaffCount(
                    Math.max(1, parseInt(e.target.value) || 1)
                  )
                }
                className="w-20 text-center bg-slate-700 border-slate-600 text-white"
                min={1}
                max={50}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 border-slate-600"
                onClick={() =>
                  setRequiredStaffCount(Math.min(50, requiredStaffCount + 1))
                }
              >
                +
              </Button>
              <span className="text-sm text-slate-400 ml-2">kişi</span>
            </div>
          </div>

          {/* Personel Görevleri */}
          <div className="space-y-2">
            <Label className="text-slate-300">Atanabilecek Görevler</Label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_POINT_ROLES.map((role) => {
                const isSelected = allowedRoles.includes(role.value);
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => handleRoleToggle(role.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                      isSelected
                        ? "ring-2 ring-offset-2 ring-offset-slate-800"
                        : "opacity-50 hover:opacity-75"
                    )}
                    style={{
                      backgroundColor: isSelected
                        ? `${role.color}30`
                        : `${role.color}10`,
                      color: role.color,
                      boxShadow: isSelected
                        ? `0 0 0 2px ${role.color}`
                        : "none",
                    }}
                  >
                    {role.label}
                  </button>
                );
              })}
            </div>
            {allowedRoles.length === 0 && (
              <p className="text-xs text-amber-400">En az bir görev seçin</p>
            )}
          </div>

          {/* Renk Seçimi */}
          <div className="space-y-2">
            <Label className="text-slate-300">Renk</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-28 bg-slate-700 border-slate-600 text-white font-mono text-sm"
              />
              {/* Hızlı renk seçenekleri */}
              <div className="flex gap-1">
                {SERVICE_POINT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setColor(type.color)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform hover:scale-110",
                      color === type.color &&
                        "ring-2 ring-white ring-offset-2 ring-offset-slate-800"
                    )}
                    style={{ backgroundColor: type.color }}
                    title={type.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Açıklama */}
          <div className="space-y-2">
            <Label className="text-slate-300">Açıklama (Opsiyonel)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu hizmet noktası hakkında notlar..."
              className="bg-slate-700 border-slate-600 text-white resize-none"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-600"
          >
            İptal
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || allowedRoles.length === 0}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            {mode === "create" ? "Ekle" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
