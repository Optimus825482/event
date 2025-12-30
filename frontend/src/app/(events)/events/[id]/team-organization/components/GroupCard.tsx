"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { Edit2, Trash2, Check, X, GripVertical, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  TableGroup,
  DEFAULT_COLORS,
  STAFF_ROLES,
  GroupStaffAssignment,
} from "../types";
import { cn } from "@/lib/utils";

interface GroupCardProps {
  group: TableGroup;
  tableCount: number;
  isSelected?: boolean;
  isDragging?: boolean;
  isDraggable?: boolean;
  onEdit?: (groupId: string, updates: Partial<TableGroup>) => void;
  onDelete?: (groupId: string) => void;
  onClick?: (groupId: string) => void;
  onColorChange?: (groupId: string, color: string) => void;
}

export const GroupCard = memo(function GroupCard({
  group,
  tableCount,
  isSelected = false,
  isDragging = false,
  isDraggable = false,
  onEdit,
  onDelete,
  onClick,
  onColorChange,
}: GroupCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Personel rol sayılarını hesapla
  const staffByRole = useMemo(() => {
    if (!group.staffAssignments || group.staffAssignments.length === 0) {
      return null;
    }

    const roleCount: Record<string, number> = {};
    group.staffAssignments.forEach((assignment: GroupStaffAssignment) => {
      const role = assignment.role;
      roleCount[role] = (roleCount[role] || 0) + 1;
    });

    return roleCount;
  }, [group.staffAssignments]);

  // Toplam personel sayısı
  const totalStaff = group.staffAssignments?.length || 0;

  const handleStartEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
      setEditName(group.name);
    },
    [group.name]
  );

  const handleSaveEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (editName.trim() && onEdit) {
        onEdit(group.id, { name: editName.trim() });
      }
      setIsEditing(false);
    },
    [editName, group.id, onEdit]
  );

  const handleCancelEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(false);
      setEditName(group.name);
    },
    [group.name]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDelete) {
        onDelete(group.id);
      }
    },
    [group.id, onDelete]
  );

  const handleClick = useCallback(() => {
    if (!isEditing && onClick) {
      onClick(group.id);
    }
  }, [isEditing, onClick, group.id]);

  const handleColorSelect = useCallback(
    (color: string) => {
      if (onColorChange) {
        onColorChange(group.id, color);
      }
      if (onEdit) {
        onEdit(group.id, { color });
      }
      setShowColorPicker(false);
    },
    [group.id, onColorChange, onEdit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSaveEdit(e as unknown as React.MouseEvent);
      } else if (e.key === "Escape") {
        handleCancelEdit(e as unknown as React.MouseEvent);
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  return (
    <div
      className={cn(
        "group/card relative p-3 rounded-lg border-2 transition-all cursor-pointer",
        "bg-slate-800/50 hover:bg-slate-800",
        isSelected &&
          "ring-2 ring-purple-500 ring-offset-2 ring-offset-slate-900",
        isDragging && "opacity-50 scale-95",
        group.assignedTeamId && "border-dashed"
      )}
      style={{ borderColor: group.color }}
      onClick={handleClick}
      draggable={isDraggable && !isEditing}
    >
      {/* Drag Handle */}
      {isDraggable && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-500 cursor-grab">
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      <div className={cn("flex items-center gap-2", isDraggable && "ml-4")}>
        {/* Color Indicator */}
        <button
          className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-white/20 hover:scale-110 transition-transform"
          style={{ backgroundColor: group.color }}
          onClick={(e) => {
            e.stopPropagation();
            setShowColorPicker(!showColorPicker);
          }}
          title="Renk değiştir"
        />

        {/* Name */}
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 text-sm bg-slate-700 border-slate-600"
              autoFocus
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-emerald-400 hover:text-emerald-300"
              onClick={handleSaveEdit}
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-400 hover:text-slate-300"
              onClick={handleCancelEdit}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <span className="text-sm font-medium text-white flex-1 truncate">
              {group.name}
            </span>

            {totalStaff > 0 && (
              <Badge
                variant="secondary"
                className="bg-emerald-600/20 text-emerald-400 text-xs"
              >
                <Users className="w-3 h-3 mr-1" />
                {totalStaff}
              </Badge>
            )}
          </>
        )}

        {/* Actions */}
        {!isEditing && (onEdit || onDelete) && (
          <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
            {onEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-slate-400 hover:text-white"
                onClick={handleStartEdit}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-slate-400 hover:text-red-400"
                onClick={handleDelete}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Personel Rol Sayıları */}
      {staffByRole && Object.keys(staffByRole).length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap gap-1">
          {Object.entries(staffByRole).map(([role, count]) => {
            const roleConfig = STAFF_ROLES.find((r) => r.value === role);
            return (
              <span
                key={role}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${roleConfig?.color || "#6b7280"}20`,
                  color: roleConfig?.color || "#9ca3af",
                }}
              >
                {roleConfig?.label || role} {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Color Picker Dropdown */}
      {showColorPicker && (
        <div
          className="absolute top-full left-0 mt-1 p-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 grid grid-cols-8 gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {DEFAULT_COLORS.map((color) => (
            <button
              key={color}
              className={cn(
                "w-5 h-5 rounded-full border-2 hover:scale-110 transition-transform",
                color === group.color ? "border-white" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
              onClick={() => handleColorSelect(color)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
