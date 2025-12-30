"use client";

import { Users, ArrowLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PersonnelStats } from "../types";

interface StaffHeaderProps {
  activeModule: string | null;
  personnelStats: PersonnelStats | null;
  onBack: () => void;
}

export function StaffHeader({
  activeModule,
  personnelStats,
  onBack,
}: StaffHeaderProps) {
  // Ana giriş ekranı başlığı
  if (!activeModule) {
    return (
      <div className="flex flex-col items-center justify-center py-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-purple-400" />
          Ekip Yönetimi
        </h1>
        <p className="text-slate-400 mt-1">
          Personel, ekip ve etkinlik organizasyonu
        </p>
      </div>
    );
  }

  // Modül başlıkları ve badge bilgileri
  const moduleConfig: Record<
    string,
    { title: string; breadcrumb: string; badgeLabel?: string }
  > = {
    personnel: {
      title: "PERSONEL YÖNETİMİ",
      breadcrumb: "Personel Yönetimi",
      badgeLabel: "Personel",
    },
    "event-assignment": {
      title: "ETKİNLİK EKİP ORGANİZASYONU",
      breadcrumb: "Etkinlik Ekip Organizasyonu",
      badgeLabel: "Etkinlik",
    },
    reviews: {
      title: "PERSONEL DEĞERLENDİRMELERİ",
      breadcrumb: "Personel Değerlendirmeleri",
      badgeLabel: "Değerlendirme",
    },
  };

  const config = moduleConfig[activeModule];
  if (!config) return null;

  // Badge sayısını belirle
  const getBadgeCount = () => {
    if (activeModule === "personnel" && personnelStats) {
      return personnelStats.total;
    }
    return null;
  };

  const badgeCount = getBadgeCount();

  return (
    <div className="flex items-center gap-4">
      {/* Sol: Geri butonu ve breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-slate-400 text-sm">Ekip Yönetimi</span>
      </div>

      {/* Orta: Mor arka planlı başlık kutusu */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-3 bg-purple-600/20 border border-purple-500/30 rounded-lg px-6 py-2">
          <h1 className="text-base font-semibold text-purple-300 tracking-wide">
            {config.title}
          </h1>
          {badgeCount !== null && (
            <Badge className="bg-cyan-500 hover:bg-cyan-500 text-white text-xs px-2 py-0.5 rounded">
              {badgeCount} {config.badgeLabel}
            </Badge>
          )}
        </div>
      </div>

      {/* Sağ: Boşluk için placeholder (dengeleme) */}
      <div className="w-[120px]" />
    </div>
  );
}
