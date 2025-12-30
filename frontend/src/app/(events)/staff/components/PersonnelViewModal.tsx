"use client";

import { User, Briefcase, Phone, CalendarDays, Edit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl, getInitials } from "../utils";
import type { Personnel } from "../types";

interface PersonnelViewModalProps {
  personnel: Personnel | null;
  onClose: () => void;
  onEdit: () => void;
}

export function PersonnelViewModal({
  personnel,
  onClose,
  onEdit,
}: PersonnelViewModalProps) {
  if (!personnel) return null;

  return (
    <Dialog open={!!personnel} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">
            Personel Detayı - {personnel.fullName}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {personnel.fullName} personel detay bilgileri
          </DialogDescription>
          <div className="flex items-center gap-4">
            <Avatar
              className="w-28 h-28 border-4 shadow-xl"
              style={{
                borderColor:
                  personnel.status === "active" ? "#22c55e" : "#ef4444",
              }}
            >
              <AvatarImage
                src={getAvatarUrl(personnel.avatar)}
                loading="eager"
              />
              <AvatarFallback className="bg-slate-600 text-white font-bold text-3xl">
                {getInitials(personnel.fullName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="text-white text-lg">{personnel.fullName}</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30"
                >
                  {personnel.sicilNo}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    personnel.status === "active"
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : personnel.status === "inactive"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                  }`}
                >
                  {personnel.status === "active"
                    ? "Aktif"
                    : personnel.status === "inactive"
                    ? "Pasif"
                    : "Ayrıldı"}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* İş Bilgileri */}
          <div>
            <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> İş Bilgileri
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Pozisyon</p>
                <p className="text-white font-medium">
                  {personnel.position || "-"}
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Bölüm</p>
                <p className="text-white font-medium">
                  {personnel.department || "-"}
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Görev Yeri</p>
                <p className="text-white font-medium">
                  {personnel.workLocation || "-"}
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Mentor</p>
                <p className="text-white font-medium">
                  {personnel.mentor || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* İletişim Bilgileri */}
          <div>
            <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <Phone className="w-4 h-4" /> İletişim
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Telefon</p>
                <p className="text-white font-medium">
                  {personnel.phone || "-"}
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">E-posta</p>
                <p className="text-white font-medium">
                  {personnel.email || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Kişisel Bilgiler */}
          <div>
            <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" /> Kişisel Bilgiler
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Cinsiyet</p>
                <p className="text-white font-medium">
                  {personnel.gender === "male"
                    ? "Erkek"
                    : personnel.gender === "female"
                    ? "Kadın"
                    : "-"}
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Doğum Tarihi</p>
                <p className="text-white font-medium">
                  {personnel.birthDate
                    ? new Date(personnel.birthDate).toLocaleDateString("tr-TR")
                    : "-"}
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Yaş</p>
                <p className="text-white font-medium">{personnel.age || "-"}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Kan Grubu</p>
                <p className="text-white font-medium">
                  {personnel.bloodType || "-"}
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Ayakkabı No</p>
                <p className="text-white font-medium">
                  {personnel.shoeSize || "-"}
                </p>
              </div>
              {personnel.gender === "female" && (
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Çorap Bedeni</p>
                  <p className="text-white font-medium">
                    {personnel.sockSize || "-"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Tarih Bilgileri */}
          <div>
            <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Tarihler
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">İşe Giriş</p>
                <p className="text-white font-medium">
                  {personnel.hireDate
                    ? new Date(personnel.hireDate).toLocaleDateString("tr-TR")
                    : "-"}
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Kıdem (Yıl)</p>
                <p className="text-white font-medium">
                  {personnel.yearsAtCompany || "-"}
                </p>
              </div>
              {personnel.status === "terminated" && (
                <>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400">Ayrılış Tarihi</p>
                    <p className="text-white font-medium">
                      {personnel.terminationDate
                        ? new Date(
                            personnel.terminationDate
                          ).toLocaleDateString("tr-TR")
                        : "-"}
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400">Ayrılış Nedeni</p>
                    <p className="text-white font-medium">
                      {personnel.terminationReason || "-"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onEdit}
            className="border-slate-600"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Düzenle
          </Button>
          <Button
            onClick={onClose}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
