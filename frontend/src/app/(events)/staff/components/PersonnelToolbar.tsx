"use client";

import {
  UserPlus,
  Upload,
  Download,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PersonnelFilters {
  department?: string;
  workLocation?: string;
  position?: string;
  status?: string;
}

interface PersonnelToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: PersonnelFilters;
  onFiltersChange: (filters: PersonnelFilters) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  loading: boolean;
  onRefresh: () => void;
  onNewPersonnel: () => void;
  onImportCSV: () => void;
  onExportCSV: () => void;
  uniqueValues: {
    departments: string[];
    locations: string[];
    positions: string[];
  };
}

export function PersonnelToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  showFilters,
  onToggleFilters,
  loading,
  onRefresh,
  onNewPersonnel,
  onImportCSV,
  onExportCSV,
  uniqueValues,
}: PersonnelToolbarProps) {
  return (
    <>
      {/* Butonlar ve Arama */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={onNewPersonnel}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Yeni Personel
          </Button>
          <Button
            onClick={onImportCSV}
            size="sm"
            variant="outline"
            className="border-green-600 text-green-400 hover:bg-green-600/20"
          >
            <Upload className="w-4 h-4 mr-2" />
            CSV İçe Aktar
          </Button>
          <Button
            onClick={onExportCSV}
            size="sm"
            variant="outline"
            className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
          >
            <Download className="w-4 h-4 mr-2" />
            CSV Dışa Aktar
          </Button>
          <Button
            onClick={onRefresh}
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Yenile
          </Button>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Ara (isim, sicil no, bölüm...)"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className={`border-slate-600 ${
              showFilters ? "bg-purple-600 text-white" : "text-slate-300"
            }`}
            onClick={onToggleFilters}
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filtreler */}
      {showFilters && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">
                  Bölüm
                </Label>
                <Select
                  value={filters.department || "all"}
                  onValueChange={(v) =>
                    onFiltersChange({
                      ...filters,
                      department: v === "all" ? undefined : v,
                    })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {uniqueValues.departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">
                  Görev Yeri
                </Label>
                <Select
                  value={filters.workLocation || "all"}
                  onValueChange={(v) =>
                    onFiltersChange({
                      ...filters,
                      workLocation: v === "all" ? undefined : v,
                    })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {uniqueValues.locations.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">
                  Pozisyon
                </Label>
                <Select
                  value={filters.position || "all"}
                  onValueChange={(v) =>
                    onFiltersChange({
                      ...filters,
                      position: v === "all" ? undefined : v,
                    })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {uniqueValues.positions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">
                  Durum
                </Label>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(v) =>
                    onFiltersChange({
                      ...filters,
                      status: v === "all" ? undefined : v,
                    })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Pasif</SelectItem>
                    <SelectItem value="terminated">Ayrılan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
