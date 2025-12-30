"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  Users,
  UserPlus,
  Search,
  ChevronDown,
  X,
  Check,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAvatarUrl } from "../utils";
import {
  CATEGORY_ORDER,
  getPositionCategory,
  getCategoryInfo,
} from "../utils/position-categories";
import type { Team, Staff } from "../types";

interface AddMemberModalProps {
  open: boolean;
  teamId: string | null;
  teams: Team[];
  staffList: Staff[];
  onClose: () => void;
  onAddMembers: (teamId: string, memberIds: string[]) => Promise<boolean>;
}

export const AddMemberModal = memo(function AddMemberModal({
  open,
  teamId,
  teams,
  staffList,
  onClose,
  onAddMembers,
}: AddMemberModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set()
  );
  const [adding, setAdding] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedMembers(new Set());
      setExpandedCategories(new Set());
      setSearchQuery("");
    }
  }, [open]);

  // Get available staff (not in team)
  const availableStaff = useMemo(() => {
    if (!teamId) return staffList;
    const team = teams.find((t) => t.id === teamId);
    if (!team) return staffList;
    const memberIds = team.members?.map((m) => m.id) || team.memberIds || [];
    return staffList.filter((s) => !memberIds.includes(s.id));
  }, [teamId, teams, staffList]);

  // Group staff by category
  const staffByCategory = useMemo(() => {
    const categorized: Record<
      string,
      { positions: Record<string, Staff[]>; total: number }
    > = {};

    availableStaff.forEach((staff) => {
      const pos = staff.position || "Diğer";
      const category = getPositionCategory(pos);

      if (!categorized[category]) {
        categorized[category] = { positions: {}, total: 0 };
      }
      if (!categorized[category].positions[pos]) {
        categorized[category].positions[pos] = [];
      }
      categorized[category].positions[pos].push(staff);
      categorized[category].total++;
    });

    // Sort by category order
    const sorted: typeof categorized = {};
    CATEGORY_ORDER.forEach((cat) => {
      if (categorized[cat]) {
        const sortedPositions = Object.entries(categorized[cat].positions).sort(
          ([a], [b]) => a.localeCompare(b, "tr")
        );
        sorted[cat] = {
          positions: Object.fromEntries(sortedPositions),
          total: categorized[cat].total,
        };
      }
    });

    return sorted;
  }, [availableStaff]);

  // Filter by search
  const filteredStaffByCategory = useMemo(() => {
    if (!searchQuery.trim()) return staffByCategory;
    const query = searchQuery.toLowerCase();
    const filtered: typeof staffByCategory = {};

    Object.entries(staffByCategory).forEach(([category, data]) => {
      const filteredPositions: Record<string, Staff[]> = {};
      let total = 0;

      Object.entries(data.positions).forEach(([position, staffArr]) => {
        const matchedStaff = staffArr.filter(
          (s) =>
            s.fullName?.toLowerCase().includes(query) ||
            s.department?.toLowerCase().includes(query) ||
            position.toLowerCase().includes(query)
        );
        if (matchedStaff.length > 0) {
          filteredPositions[position] = matchedStaff;
          total += matchedStaff.length;
        }
      });

      if (total > 0) {
        filtered[category] = { positions: filteredPositions, total };
      }
    });

    return filtered;
  }, [staffByCategory, searchQuery]);

  // Toggle category expand
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      const key = `cat_${category}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Toggle member selection
  const toggleMember = useCallback((staffId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  }, []);

  // Toggle all in category
  const toggleCategorySelection = useCallback(
    (category: string) => {
      const categoryData = filteredStaffByCategory[category];
      if (!categoryData) return;
      const allStaff = Object.values(categoryData.positions).flat();
      const allSelected = allStaff.every((s) => selectedMembers.has(s.id));

      setSelectedMembers((prev) => {
        const next = new Set(prev);
        if (allSelected) {
          allStaff.forEach((s) => next.delete(s.id));
        } else {
          allStaff.forEach((s) => next.add(s.id));
        }
        return next;
      });
    },
    [filteredStaffByCategory, selectedMembers]
  );

  // Expand/collapse all
  const toggleAllCategories = useCallback(() => {
    const allKeys = Object.keys(filteredStaffByCategory).map((c) => `cat_${c}`);
    if (allKeys.every((k) => expandedCategories.has(k))) {
      setExpandedCategories(new Set());
    } else {
      setExpandedCategories(new Set(allKeys));
    }
  }, [filteredStaffByCategory, expandedCategories]);

  // Handle add members
  const handleAdd = useCallback(async () => {
    if (!teamId || selectedMembers.size === 0) return;
    setAdding(true);
    const success = await onAddMembers(teamId, Array.from(selectedMembers));
    setAdding(false);
    if (success) {
      onClose();
    }
  }, [teamId, selectedMembers, onAddMembers, onClose]);

  const totalAvailable = Object.values(filteredStaffByCategory).reduce(
    (sum, cat) => sum + cat.total,
    0
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 !max-w-[900px] w-[900px] h-[85vh] flex flex-col p-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700 bg-slate-800/50 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <span className="text-white">Ekibe Üye Ekle</span>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Kategoriye göre personel seçin
                </p>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Ekibe eklenecek personelleri seçin
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3 shrink-0 bg-slate-800/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Personel veya unvan ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 bg-slate-800 border-slate-700 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAllCategories}
            className="h-9 px-4 border-slate-600 text-slate-300"
          >
            {Object.keys(filteredStaffByCategory).every((c) =>
              expandedCategories.has(`cat_${c}`)
            )
              ? "Tümünü Daralt"
              : "Tümünü Genişlet"}
          </Button>

          {selectedMembers.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 px-3 py-1">
                {selectedMembers.size} kişi seçili
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMembers(new Set())}
                className="text-slate-400 h-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {Object.keys(filteredStaffByCategory).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Users className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-base">
                {searchQuery
                  ? "Sonuç bulunamadı"
                  : "Eklenebilecek personel yok"}
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {Object.entries(filteredStaffByCategory).map(
                ([category, categoryData]) => (
                  <CategorySection
                    key={category}
                    category={category}
                    categoryData={categoryData}
                    isExpanded={expandedCategories.has(`cat_${category}`)}
                    selectedMembers={selectedMembers}
                    onToggleCategory={() => toggleCategory(category)}
                    onToggleCategorySelection={() =>
                      toggleCategorySelection(category)
                    }
                    onToggleMember={toggleMember}
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between shrink-0">
          <span className="text-sm text-slate-400">
            Toplam {totalAvailable} personel
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-10 px-5 border-slate-600"
              disabled={adding}
            >
              İptal
            </Button>
            <Button
              onClick={handleAdd}
              className="h-10 px-6 bg-blue-600 hover:bg-blue-700"
              disabled={selectedMembers.size === 0 || adding}
            >
              {adding ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Ekleniyor...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {selectedMembers.size} Kişiyi Ekle
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

// Category Section Sub-component
interface CategorySectionProps {
  category: string;
  categoryData: { positions: Record<string, Staff[]>; total: number };
  isExpanded: boolean;
  selectedMembers: Set<string>;
  onToggleCategory: () => void;
  onToggleCategorySelection: () => void;
  onToggleMember: (staffId: string) => void;
}

const CategorySection = memo(function CategorySection({
  category,
  categoryData,
  isExpanded,
  selectedMembers,
  onToggleCategory,
  onToggleCategorySelection,
  onToggleMember,
}: CategorySectionProps) {
  const catInfo = getCategoryInfo(category);
  const allStaff = Object.values(categoryData.positions).flat();
  const selectedCount = allStaff.filter((s) =>
    selectedMembers.has(s.id)
  ).length;
  const allSelected = selectedCount === allStaff.length && allStaff.length > 0;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/50 bg-slate-800/30">
      {/* Category Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer transition-all hover:bg-slate-700/30"
        style={{ borderLeft: `4px solid ${catInfo.color}` }}
        onClick={onToggleCategory}
      >
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onToggleCategorySelection}
            onClick={(e) => e.stopPropagation()}
            className="border-slate-500 data-[state=checked]:bg-blue-600 h-5 w-5"
          />
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: catInfo.color }}
          />
          <span className="text-base font-semibold text-white">
            {catInfo.label}
          </span>
          {selectedCount > 0 && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
              {selectedCount} seçili
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="text-sm px-3"
            style={{
              backgroundColor: `${catInfo.color}20`,
              color: catInfo.color,
              borderColor: `${catInfo.color}50`,
            }}
          >
            {categoryData.total} kişi
          </Badge>
          <ChevronDown
            className={`w-5 h-5 text-slate-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Staff Table */}
      {isExpanded && (
        <div className="border-t border-slate-700/50">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-slate-800/50 text-xs font-medium text-slate-400 uppercase tracking-wider">
            <div className="col-span-1"></div>
            <div className="col-span-4">Ad Soyad</div>
            <div className="col-span-4">Unvan</div>
            <div className="col-span-3">Bölüm</div>
          </div>

          {/* Staff Rows */}
          <div className="max-h-[300px] overflow-y-auto">
            {allStaff.map((staff) => (
              <StaffRow
                key={staff.id}
                staff={staff}
                isSelected={selectedMembers.has(staff.id)}
                categoryColor={catInfo.color}
                onToggle={() => onToggleMember(staff.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// Staff Row Sub-component
interface StaffRowProps {
  staff: Staff;
  isSelected: boolean;
  categoryColor: string;
  onToggle: () => void;
}

const StaffRow = memo(function StaffRow({
  staff,
  isSelected,
  categoryColor,
  onToggle,
}: StaffRowProps) {
  return (
    <div
      className={`grid grid-cols-12 gap-3 px-4 py-2.5 items-center cursor-pointer transition-colors border-t border-slate-700/30 ${
        isSelected ? "bg-blue-500/10" : "hover:bg-slate-700/20"
      }`}
      onClick={onToggle}
    >
      <div className="col-span-1 flex items-center">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="border-slate-500 data-[state=checked]:bg-blue-600 h-4 w-4"
        />
      </div>
      <div className="col-span-4 flex items-center gap-2.5">
        <Avatar className="w-8 h-8">
          <AvatarImage src={getAvatarUrl(staff.avatar)} />
          <AvatarFallback
            style={{ backgroundColor: staff.color || categoryColor }}
            className="text-white text-xs font-medium"
          >
            {staff.fullName?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-white font-medium truncate">
          {staff.fullName}
        </span>
      </div>
      <div className="col-span-4">
        <span className="text-sm text-slate-300 truncate block">
          {staff.position || "-"}
        </span>
      </div>
      <div className="col-span-3">
        <span className="text-sm text-slate-400 truncate block">
          {staff.department || "-"}
        </span>
      </div>
    </div>
  );
});
