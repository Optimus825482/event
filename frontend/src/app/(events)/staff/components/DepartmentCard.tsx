"use client";

import {
  Building2,
  ChevronDown,
  Eye,
  Edit2,
  Trash2,
  Hash,
  Briefcase,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getAvatarUrl, getInitials } from "../utils";
import type { Personnel, DepartmentSummary } from "../types";

interface DepartmentCardProps {
  item: DepartmentSummary;
  isExpanded: boolean;
  isLoading: boolean;
  cachedPersonnel: Personnel[];
  onToggle: () => void;
  onView: (person: Personnel) => void;
  onEdit: (person: Personnel) => void;
  onDelete: (person: Personnel) => void;
}

export function DepartmentCard({
  item,
  isExpanded,
  isLoading,
  cachedPersonnel,
  onToggle,
  onView,
  onEdit,
  onDelete,
}: DepartmentCardProps) {
  return (
    <Card
      className={`bg-slate-800 border-slate-700 overflow-hidden transition-all ${
        isExpanded ? "col-span-1 md:col-span-2" : ""
      }`}
    >
      {/* Departman Header - Tıklanabilir */}
      <div
        className="h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 cursor-pointer"
        onClick={onToggle}
      />
      <div
        className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{item.department}</h3>
              <p className="text-xs text-slate-400">
                {item.activeCount} aktif / {item.count} toplam
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-sm bg-blue-500/20 text-blue-400 border-blue-500/30"
            >
              {item.count}
            </Badge>
            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>
      </div>

      {/* Genişletilmiş İçerik - Personel Listesi */}
      {isExpanded && (
        <div className="border-t border-slate-700">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-slate-700" />
              ))}
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <div className="divide-y divide-slate-700/50">
                {cachedPersonnel.map((person) => (
                  <div
                    key={person.id}
                    className="p-3 hover:bg-slate-700/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        className="w-10 h-10 border-2 flex-shrink-0"
                        style={{
                          borderColor:
                            person.status === "active" ? "#22c55e" : "#ef4444",
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
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {person.fullName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {person.sicilNo}
                          </span>
                          {person.position && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-3 h-3" />
                              {person.position}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            onView(person);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(person);
                          }}
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
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
