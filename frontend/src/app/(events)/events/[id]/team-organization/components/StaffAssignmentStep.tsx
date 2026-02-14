"use client";

import { useState, useCallback, useMemo } from "react";
import {
  UserPlus,
  Users,
  Clock,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  TableData,
  TableGroup,
  Staff,
  GroupStaffAssignment,
} from "../types";
import { STAFF_ROLES, DEFAULT_COLORS } from "../types";
import { StaffAssignmentModal } from "./StaffAssignmentModal";

interface StaffAssignmentStepProps {
  tables: TableData[];
  tableGroups: TableGroup[];
  allStaff: Staff[];
  onUpdateTableGroup: (groupId: string, updates: Partial<TableGroup>) => void;
  onAssignStaffToGroup: (
    groupId: string,
    assignments: GroupStaffAssignment[],
  ) => void;
  onRemoveStaffFromGroup: (groupId: string, assignmentId: string) => void;
  onUpdateStaffAssignment: (
    groupId: string,
    assignmentId: string,
    updates: Partial<GroupStaffAssignment>,
  ) => void;
  onAddTableGroup: (
    name: string,
    tableIds: string[],
    color?: string,
  ) => TableGroup;
}

export function StaffAssignmentStep({
  tables,
  tableGroups,
  allStaff,
  onUpdateTableGroup,
  onAssignStaffToGroup,
  onRemoveStaffFromGroup,
  onUpdateStaffAssignment,
  onAddTableGroup,
}: StaffAssignmentStepProps) {
  const [showModal, setShowModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Tüm gruplardaki atanmış personelleri topla
  const allAssignments = useMemo(() => {
    const assignments: Array<{
      groupId: string;
      groupName: string;
      groupColor: string;
      assignment: GroupStaffAssignment;
      tableLabels: string[];
    }> = [];

    tableGroups.forEach((group) => {
      (group.staffAssignments || []).forEach((a) => {
        const tableLabels = group.tableIds
          .map((tid) => {
            const t = tables.find((tb) => tb.id === tid);
            return t?.label || tid;
          })
          .sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));

        assignments.push({
          groupId: group.id,
          groupName: group.name,
          groupColor: group.color,
          assignment: a,
          tableLabels,
        });
      });
    });

    return assignments;
  }, [tableGroups, tables]);

  // Atanmamış masaları bul
  const unassignedTables = useMemo(() => {
    const assignedTableIds = new Set(
      tableGroups.flatMap((g) =>
        (g.staffAssignments?.length || 0) > 0 ? g.tableIds : [],
      ),
    );
    return tables.filter((t) => !assignedTableIds.has(t.id));
  }, [tables, tableGroups]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleSaveAssignment = useCallback(
    (data: {
      staffId: string;
      staffName: string;
      position: string;
      tableIds: string[];
      shiftStart: string;
      shiftEnd: string;
    }) => {
      // Seçilen masaların hangi gruplara ait olduğunu bul
      const groupMap = new Map<string, string[]>();

      data.tableIds.forEach((tableId) => {
        // Mevcut gruplarda bu masa var mı?
        const existingGroup = tableGroups.find((g) =>
          g.tableIds.includes(tableId),
        );
        if (existingGroup) {
          const existing = groupMap.get(existingGroup.id) || [];
          existing.push(tableId);
          groupMap.set(existingGroup.id, existing);
        } else {
          // Grupsuz masalar - "auto" grubuna ekle
          const existing = groupMap.get("__new__") || [];
          existing.push(tableId);
          groupMap.set("__new__", existing);
        }
      });

      // Yeni grup gerekiyorsa oluştur
      if (groupMap.has("__new__")) {
        const newTableIds = groupMap.get("__new__")!;
        const staff = allStaff.find((s) => s.id === data.staffId);
        const colorIndex = tableGroups.length % DEFAULT_COLORS.length;
        const groupName = `${data.staffName} Grubu`;
        const newGroup = onAddTableGroup(
          groupName,
          newTableIds,
          staff?.color || DEFAULT_COLORS[colorIndex],
        );
        groupMap.delete("__new__");
        groupMap.set(newGroup.id, newTableIds);
      }

      // Her gruba personel ataması yap
      const roleKey =
        STAFF_ROLES.find(
          (r) => r.label.toLowerCase() === data.position.toLowerCase(),
        )?.value || "waiter";

      groupMap.forEach((_, groupId) => {
        const assignment: GroupStaffAssignment = {
          id: `assign-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          staffId: data.staffId,
          staffName: data.staffName,
          role: roleKey as any,
          shiftStart: data.shiftStart,
          shiftEnd: data.shiftEnd,
          isExtra: false,
        };
        onAssignStaffToGroup(groupId, [assignment]);
      });
    },
    [tableGroups, allStaff, onAddTableGroup, onAssignStaffToGroup],
  );

  const getRoleLabel = (role: string) => {
    return STAFF_ROLES.find((r) => r.value === role)?.label || role;
  };

  const getRoleColor = (role: string) => {
    return STAFF_ROLES.find((r) => r.value === role)?.color || "#6b7280";
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-400" />
            Personel Atama
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Personel arayın, görev ve masalarını belirleyin. Masalar otomatik
            gruplanır.
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Personel Ata
        </Button>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">
            {allAssignments.length}
          </div>
          <div className="text-xs text-slate-400">Atanan Personel</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {
              tableGroups.filter((g) => (g.staffAssignments?.length || 0) > 0)
                .length
            }
          </div>
          <div className="text-xs text-slate-400">Aktif Grup</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {tables.length - unassignedTables.length}
          </div>
          <div className="text-xs text-slate-400">Atanmış Masa</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-400">
            {unassignedTables.length}
          </div>
          <div className="text-xs text-slate-400">Boş Masa</div>
        </div>
      </div>

      {/* Atanmış Personel Listesi */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {allAssignments.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Henüz personel atanmadı</p>
            <p className="text-xs mt-1">
              &quot;Personel Ata&quot; butonuna tıklayarak başlayın
            </p>
          </div>
        ) : (
          /* Gruplara göre göster */
          tableGroups
            .filter((g) => (g.staffAssignments?.length || 0) > 0)
            .map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const groupTables = group.tableIds
                .map((tid) => tables.find((t) => t.id === tid))
                .filter(Boolean);

              return (
                <div
                  key={group.id}
                  className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
                >
                  {/* Grup Header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-750 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="text-sm font-medium text-white">
                        {group.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {group.staffAssignments?.length || 0} personel •{" "}
                        {group.tableIds.length} masa
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {/* Grup İçeriği */}
                  {isExpanded && (
                    <div className="border-t border-slate-700 p-3 space-y-2">
                      {/* Masalar */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {groupTables.map((t) => (
                          <span
                            key={t!.id}
                            className="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300"
                          >
                            {t!.label}
                          </span>
                        ))}
                      </div>

                      {/* Personeller */}
                      {(group.staffAssignments || []).map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-white">
                              {(assignment.staffName || "?")
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                            <div>
                              <div className="text-sm text-white">
                                {assignment.staffName}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span
                                  className="px-1.5 py-0.5 rounded text-white"
                                  style={{
                                    backgroundColor: getRoleColor(
                                      assignment.role,
                                    ),
                                  }}
                                >
                                  {getRoleLabel(assignment.role)}
                                </span>
                                <span className="text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {assignment.shiftStart} -{" "}
                                  {assignment.shiftEnd}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              onRemoveStaffFromGroup(group.id, assignment.id)
                            }
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <StaffAssignmentModal
          tables={tables}
          tableGroups={tableGroups}
          allStaff={allStaff}
          onSave={handleSaveAssignment}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
