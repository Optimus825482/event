"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, Crown } from "lucide-react";
import { staffApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAvatarUrl } from "../utils";
import type { Team, Staff } from "../types";

const DEFAULT_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
];

interface TeamFormModalProps {
  open: boolean;
  team: Team | null;
  staffList: Staff[];
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

export function TeamFormModal({
  open,
  team,
  staffList,
  onClose,
  onSave,
}: TeamFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    color: "#3b82f6",
    leaderId: "",
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (team) {
        setFormData({
          name: team.name,
          color: team.color,
          leaderId: team.leaderId || "",
        });
        setSelectedMembers(
          team.members?.map((m) => m.id) || team.memberIds || []
        );
      } else {
        setFormData({
          name: "",
          color:
            DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
          leaderId: "",
        });
        setSelectedMembers([]);
      }
      setError("");
    }
  }, [open, team]);

  const toggleMember = (staffId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Ekip adı zorunludur");
      return;
    }

    setSaving(true);
    try {
      if (team) {
        await staffApi.updateTeam(team.id, {
          name: formData.name,
          color: formData.color,
          leaderId: formData.leaderId || undefined,
          memberIds: selectedMembers,
        });
      } else {
        await staffApi.createTeam({
          name: formData.name,
          color: formData.color,
          leaderId: formData.leaderId || undefined,
          memberIds: selectedMembers,
        });
      }
      await onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  };

  // Lider adayları (seçili üyelerden)
  const leaderCandidates = staffList.filter((s) =>
    selectedMembers.includes(s.id)
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle>{team ? "Ekip Düzenle" : "Yeni Ekip"}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Ekip bilgilerini ve üyelerini belirleyin
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Ekip Adı *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Örn: A Takımı"
                className="bg-slate-700 border-slate-600 h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ekip Rengi</Label>
              <div className="flex gap-1 flex-wrap">
                {DEFAULT_COLORS.slice(0, 8).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      formData.color === color
                        ? "border-white scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {formData.color === color && (
                      <Check className="w-3 h-3 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {leaderCandidates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Ekip Lideri</Label>
              <div className="flex gap-2 flex-wrap">
                {leaderCandidates.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        leaderId:
                          formData.leaderId === staff.id ? "" : staff.id,
                      })
                    }
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                      formData.leaderId === staff.id
                        ? "border-amber-500 bg-amber-500/20"
                        : "border-slate-600 bg-slate-700/50 hover:bg-slate-700"
                    }`}
                  >
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={getAvatarUrl(staff.avatar)} />
                      <AvatarFallback
                        style={{ backgroundColor: staff.color }}
                        className="text-white text-xs"
                      >
                        {staff.fullName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-white">{staff.fullName}</span>
                    {formData.leaderId === staff.id && (
                      <Crown className="w-3 h-3 text-amber-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">
              Üyeler ({selectedMembers.length} seçili)
            </Label>
            <ScrollArea className="h-[200px] border border-slate-700 rounded-lg p-2">
              <div className="space-y-1">
                {staffList.map((staff) => (
                  <div
                    key={staff.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedMembers.includes(staff.id)
                        ? "bg-blue-500/20 border border-blue-500/30"
                        : "bg-slate-700/30 hover:bg-slate-700/50"
                    }`}
                    onClick={() => toggleMember(staff.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={getAvatarUrl(staff.avatar)} />
                        <AvatarFallback
                          style={{ backgroundColor: staff.color }}
                          className="text-white text-xs"
                        >
                          {staff.fullName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm text-white">{staff.fullName}</p>
                        <span className="text-xs text-slate-400">
                          {staff.position || "Personel"}
                        </span>
                      </div>
                    </div>
                    {selectedMembers.includes(staff.id) && (
                      <Check className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-600"
              disabled={saving}
            >
              İptal
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {team ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
