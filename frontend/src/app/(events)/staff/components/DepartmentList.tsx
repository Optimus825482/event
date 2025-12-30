"use client";

import {
  Building2,
  ChevronDown,
  Edit2,
  Trash2,
  Hash,
  Briefcase,
  Users,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getAvatarUrl, getInitials } from "../utils";
import type { Personnel, DepartmentSummary } from "../types";

interface DepartmentListProps {
  departments: DepartmentSummary[];
  expandedDepartments: Set<string>;
  loadingDepartments: Set<string>;
  personnelByDepartmentCache: Record<string, Personnel[]>;
  loading: boolean;
  onToggle: (department: string) => void;
  onView: (person: Personnel) => void;
  onEdit: (person: Personnel) => void;
  onDelete: (person: Personnel) => void;
  onAddFirst?: () => void;
}

export function DepartmentList({
  departments,
  expandedDepartments,
  loadingDepartments,
  personnelByDepartmentCache,
  loading,
  onToggle,
  onView,
  onEdit,
  onDelete,
  onAddFirst,
}: DepartmentListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full bg-slate-700 rounded-lg" />
        ))}
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
        <Users className="w-12 h-12 mx-auto text-slate-600 mb-4" />
        <p className="text-slate-400 mb-2">Henüz personel kaydı yok</p>
        {onAddFirst && (
          <Button
            onClick={onAddFirst}
            className="bg-purple-600 hover:bg-purple-700 mt-2"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            İlk Personeli Ekle
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {departments.map((item) => {
        const isExpanded = expandedDepartments.has(item.department);
        const isLoading = loadingDepartments.has(item.department);
        const cachedPersonnel =
          personnelByDepartmentCache[item.department] || [];

        return (
          <div
            key={item.department}
            className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
          >
            {/* Departman Header - Tıklanabilir */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-700/50 transition-colors"
              onClick={() => onToggle(item.department)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white text-sm">
                    {item.department}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {item.activeCount} aktif / {item.count} toplam
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="text-sm bg-blue-500/20 text-blue-400 border-blue-500/30 min-w-[40px] justify-center"
                >
                  {item.count}
                </Badge>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>

            {/* Genişletilmiş İçerik - Personel Listesi */}
            {isExpanded && (
              <div className="border-t border-slate-700 bg-slate-800/50">
                {isLoading ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full bg-slate-700" />
                    ))}
                  </div>
                ) : cachedPersonnel.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    Bu departmanda personel bulunamadı
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
                    {/* Tablo Header */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-700/30 text-xs text-slate-400 font-medium sticky top-0">
                      <div className="col-span-1">#</div>
                      <div className="col-span-4">Ad Soyad</div>
                      <div className="col-span-2">Sicil No</div>
                      <div className="col-span-3">Pozisyon</div>
                      <div className="col-span-2 text-right">İşlemler</div>
                    </div>

                    {/* Personel Satırları */}
                    {cachedPersonnel.map((person, idx) => (
                      <div
                        key={person.id}
                        className="grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-0 group cursor-pointer"
                        onClick={() => onView(person)}
                      >
                        {/* Sıra No */}
                        <div className="col-span-1 text-xs text-slate-500">
                          {idx + 1}
                        </div>

                        {/* Avatar + İsim */}
                        <div className="col-span-4 flex items-center gap-2">
                          <Avatar
                            className="w-8 h-8 border-2 flex-shrink-0"
                            style={{
                              borderColor:
                                person.status === "active"
                                  ? "#22c55e"
                                  : "#ef4444",
                            }}
                          >
                            <AvatarImage
                              src={getAvatarUrl(person.avatar)}
                              alt={person.fullName}
                            />
                            <AvatarFallback className="text-white font-bold text-xs bg-slate-600">
                              {getInitials(person.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-white truncate">
                            {person.fullName}
                          </span>
                        </div>

                        {/* Sicil No */}
                        <div className="col-span-2 text-xs text-slate-400 flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {person.sicilNo}
                        </div>

                        {/* Pozisyon */}
                        <div className="col-span-3 text-xs text-slate-400 truncate flex items-center gap-1">
                          <Briefcase className="w-3 h-3 flex-shrink-0" />
                          {person.position || "-"}
                        </div>

                        {/* İşlemler */}
                        <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(person);
                            }}
                            title="Düzenle"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(person);
                            }}
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
