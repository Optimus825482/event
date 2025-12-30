"use client";

import { Users, Calendar, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PersonnelStats, Event } from "../types";

interface ModuleCardsProps {
  personnelStats: PersonnelStats | null;
  personnelCount: number;
  events: Event[];
  onSelectModule: (module: string) => void;
}

export function ModuleCards({
  personnelStats,
  personnelCount,
  events,
  onSelectModule,
}: ModuleCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* 1. Personel İşlemleri */}
      <Card
        className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer group"
        onClick={() => onSelectModule("personnel")}
      >
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
              <Users className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Personel İşlemleri
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                HR personel kayıtları, sicil bilgileri ve özlük işlemleri
              </p>
            </div>
            <Badge
              variant="outline"
              className="bg-purple-500/10 border-purple-500/30 text-purple-400"
            >
              {personnelStats?.total || personnelCount || 0} Personel
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 2. Etkinlik Ekip Organizasyonu */}
      <Card
        className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-amber-500/50 transition-all cursor-pointer group"
        onClick={() => onSelectModule("event-assignment")}
      >
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
              <Calendar className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Etkinlik Ekip Organizasyonu
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Etkinlik yerleşim planı üzerinde oluşturulmuş ekiplerin
                planlaması
              </p>
            </div>
            <Badge
              variant="outline"
              className="bg-amber-500/10 border-amber-500/30 text-amber-400"
            >
              {events.length} Etkinlik
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 3. Personel Değerlendirmeleri */}
      <Card
        className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-green-500/50 transition-all cursor-pointer group"
        onClick={() => onSelectModule("reviews")}
      >
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
              <Star className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Personel Değerlendirmeleri
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Tüm personellerin etkinlik bazlı performans değerlendirmeleri
              </p>
            </div>
            <Badge
              variant="outline"
              className="bg-green-500/10 border-green-500/30 text-green-400"
            >
              Değerlendirmeler
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
