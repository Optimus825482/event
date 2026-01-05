"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  WizardStep,
  WizardState,
  TableGroup,
  TeamDefinition,
  TeamStaffRequirement,
  StaffRole,
  GroupStaffAssignment,
  DEFAULT_COLORS,
} from "../types";

const STEP_ORDER: WizardStep[] = [
  "table-grouping",
  "team-assignment",
  "summary",
];

const AUTO_SAVE_INTERVAL = 30000; // 30 saniye

export interface UseWizardStateOptions {
  initialStep?: WizardStep;
  initialState?: Partial<WizardState>;
}

export function useWizardState(options?: UseWizardStateOptions) {
  const { initialStep, initialState } = options || {};

  // initialStep parametresi öncelikli, sonra initialState.currentStep, en son default
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    initialStep || initialState?.currentStep || "table-grouping"
  );
  const [tableGroups, setTableGroups] = useState<TableGroup[]>(
    initialState?.tableGroups || []
  );
  const [teams, setTeams] = useState<TeamDefinition[]>(
    initialState?.teams || []
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [lastDraftSave, setLastDraftSave] = useState<Date | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Auto-save ref
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (hasChanges) {
      autoSaveRef.current = setInterval(() => {
        const draft = {
          tableGroups,
          teams,
          currentStep,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem("team-organization-draft", JSON.stringify(draft));
        setLastDraftSave(new Date());
      }, AUTO_SAVE_INTERVAL);
    }

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, [hasChanges, tableGroups, teams, currentStep]);

  // Step Navigation
  const currentStepIndex = useMemo(
    () => STEP_ORDER.indexOf(currentStep),
    [currentStep]
  );

  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case "table-grouping":
        // Gruplar varsa ve personel atanmışsa İleri butonu aktif
        return (
          tableGroups.length > 0 &&
          tableGroups.some(
            (g) => g.staffAssignments && g.staffAssignments.length > 0
          )
        );
      case "team-assignment":
        // Takımlar oluşturulmuş ve gruplar atanmışsa
        return teams.length > 0 && tableGroups.some((g) => g.assignedTeamId);
      case "summary":
        return false;
      default:
        return true;
    }
  }, [currentStep, tableGroups, teams]);

  // Grupların takıma atanıp atanmadığını kontrol et
  const hasUnassignedGroups = useMemo(() => {
    return tableGroups.length > 0 && !tableGroups.some((g) => g.assignedTeamId);
  }, [tableGroups]);

  const canGoPrev = useMemo(() => currentStepIndex > 0, [currentStepIndex]);

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  const goNext = useCallback(() => {
    if (currentStepIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentStepIndex + 1]);
    }
  }, [currentStepIndex]);

  const goPrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEP_ORDER[currentStepIndex - 1]);
    }
  }, [currentStepIndex]);

  // Table Group Operations
  const addTableGroup = useCallback(
    (name: string, tableIds: string[], color?: string) => {
      const newGroup: TableGroup = {
        id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        name,
        color:
          color || DEFAULT_COLORS[tableGroups.length % DEFAULT_COLORS.length],
        tableIds,
        staffAssignments: [],
      };
      setTableGroups((prev) => [...prev, newGroup]);
      setHasChanges(true);
      return newGroup;
    },
    [tableGroups.length]
  );

  const updateTableGroup = useCallback(
    (groupId: string, updates: Partial<TableGroup>) => {
      setTableGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g))
      );
      setHasChanges(true);
    },
    []
  );

  const deleteTableGroup = useCallback((groupId: string) => {
    setTableGroups((prev) => prev.filter((g) => g.id !== groupId));
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        assignedGroupIds: t.assignedGroupIds.filter((id) => id !== groupId),
      }))
    );
    setHasChanges(true);
  }, []);

  const addTablesToGroup = useCallback(
    (groupId: string, tableIds: string[]) => {
      setTableGroups((prev) =>
        prev.map((g) => ({
          ...g,
          tableIds:
            g.id === groupId
              ? [...new Set([...g.tableIds, ...tableIds])]
              : g.tableIds.filter((id) => !tableIds.includes(id)),
        }))
      );
      setHasChanges(true);
    },
    []
  );

  const removeTablesFromGroup = useCallback(
    (groupId: string, tableIds: string[]) => {
      setTableGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                tableIds: g.tableIds.filter((id) => !tableIds.includes(id)),
              }
            : g
        )
      );
      setHasChanges(true);
    },
    []
  );

  // Team Operations
  const addTeam = useCallback(
    (
      name: string,
      color?: string,
      leaders?: Array<{ staffId: string; staffName: string; role: string }>
    ) => {
      const newTeam: TeamDefinition & {
        leaders?: Array<{ staffId: string; staffName: string; role: string }>;
      } = {
        id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        name,
        color: color || DEFAULT_COLORS[teams.length % DEFAULT_COLORS.length],
        requiredStaff: [],
        assignedGroupIds: [],
        leaders: leaders || [],
      };
      setTeams((prev) => [...prev, newTeam as TeamDefinition]);
      setHasChanges(true);
      return newTeam as TeamDefinition;
    },
    [teams.length]
  );

  const updateTeam = useCallback(
    (
      teamId: string,
      updates: Partial<TeamDefinition> & {
        leaders?: Array<{ staffId: string; staffName: string; role: string }>;
      }
    ) => {
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, ...updates } : t))
      );
      setHasChanges(true);
    },
    []
  );

  const deleteTeam = useCallback((teamId: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
    setTableGroups((prev) =>
      prev.map((g) =>
        g.assignedTeamId === teamId ? { ...g, assignedTeamId: undefined } : g
      )
    );
    setHasChanges(true);
  }, []);

  // Team Staff Requirements
  const addStaffRequirement = useCallback(
    (teamId: string, role: StaffRole, count: number) => {
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== teamId) return t;
          const existing = t.requiredStaff.find((r) => r.role === role);
          if (existing) {
            return {
              ...t,
              requiredStaff: t.requiredStaff.map((r) =>
                r.role === role ? { ...r, count } : r
              ),
            };
          }
          return {
            ...t,
            requiredStaff: [
              ...t.requiredStaff,
              { role, count, assignedStaffIds: [] },
            ],
          };
        })
      );
      setHasChanges(true);
    },
    []
  );

  const removeStaffRequirement = useCallback(
    (teamId: string, role: StaffRole) => {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId
            ? {
                ...t,
                requiredStaff: t.requiredStaff.filter((r) => r.role !== role),
              }
            : t
        )
      );
      setHasChanges(true);
    },
    []
  );

  const applyRequirementsToAllTeams = useCallback(
    (sourceTeamId: string) => {
      const sourceTeam = teams.find((t) => t.id === sourceTeamId);
      if (!sourceTeam || sourceTeam.requiredStaff.length === 0) return;

      setTeams((prev) =>
        prev.map((t) => {
          if (t.id === sourceTeamId) return t;
          return {
            ...t,
            requiredStaff: sourceTeam.requiredStaff.map((r) => ({
              ...r,
              assignedStaffIds: [],
            })),
          };
        })
      );
      setHasChanges(true);
    },
    [teams]
  );

  // Group-Team Assignment
  const assignGroupToTeam = useCallback((groupId: string, teamId: string) => {
    setTableGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, assignedTeamId: teamId } : g))
    );
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          return {
            ...t,
            assignedGroupIds: [...new Set([...t.assignedGroupIds, groupId])],
          };
        }
        return {
          ...t,
          assignedGroupIds: t.assignedGroupIds.filter((id) => id !== groupId),
        };
      })
    );
    setHasChanges(true);
  }, []);

  const unassignGroupFromTeam = useCallback((groupId: string) => {
    setTableGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, assignedTeamId: undefined } : g
      )
    );
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        assignedGroupIds: t.assignedGroupIds.filter((id) => id !== groupId),
      }))
    );
    setHasChanges(true);
  }, []);

  // Merge multiple groups to a team
  const mergeGroupsToTeam = useCallback(
    (groupIds: string[], teamId: string) => {
      setTableGroups((prev) =>
        prev.map((g) =>
          groupIds.includes(g.id) ? { ...g, assignedTeamId: teamId } : g
        )
      );
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id === teamId) {
            return {
              ...t,
              assignedGroupIds: [
                ...new Set([...t.assignedGroupIds, ...groupIds]),
              ],
            };
          }
          return {
            ...t,
            assignedGroupIds: t.assignedGroupIds.filter(
              (id) => !groupIds.includes(id)
            ),
          };
        })
      );
      setHasChanges(true);
    },
    []
  );

  // Staff Assignment to Group
  const assignStaffToGroup = useCallback(
    (groupId: string, assignments: GroupStaffAssignment[]) => {
      setTableGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                staffAssignments: [
                  ...(g.staffAssignments || []),
                  ...assignments,
                ],
              }
            : g
        )
      );
      setHasChanges(true);
    },
    []
  );

  const removeStaffFromGroup = useCallback(
    (groupId: string, assignmentId: string) => {
      setTableGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                staffAssignments: (g.staffAssignments || []).filter(
                  (a) => a.id !== assignmentId
                ),
              }
            : g
        )
      );
      setHasChanges(true);
    },
    []
  );

  const updateStaffAssignment = useCallback(
    (
      groupId: string,
      assignmentId: string,
      updates: Partial<GroupStaffAssignment>
    ) => {
      setTableGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                staffAssignments: (g.staffAssignments || []).map((a) =>
                  a.id === assignmentId ? { ...a, ...updates } : a
                ),
              }
            : g
        )
      );
      setHasChanges(true);
    },
    []
  );

  // Legacy Staff Assignment
  const assignStaffToTeam = useCallback(
    (teamId: string, role: StaffRole, staffId: string) => {
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== teamId) return t;
          return {
            ...t,
            requiredStaff: t.requiredStaff.map((r) =>
              r.role === role
                ? {
                    ...r,
                    assignedStaffIds: [
                      ...new Set([...r.assignedStaffIds, staffId]),
                    ],
                  }
                : r
            ),
          };
        })
      );
      setHasChanges(true);
    },
    []
  );

  const unassignStaffFromTeam = useCallback(
    (teamId: string, role: StaffRole, staffId: string) => {
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== teamId) return t;
          return {
            ...t,
            requiredStaff: t.requiredStaff.map((r) =>
              r.role === role
                ? {
                    ...r,
                    assignedStaffIds: r.assignedStaffIds.filter(
                      (id) => id !== staffId
                    ),
                  }
                : r
            ),
          };
        })
      );
      setHasChanges(true);
    },
    []
  );

  // Bulk Operations
  const clearAll = useCallback(() => {
    setTableGroups([]);
    setTeams([]);
    setCurrentStep("table-grouping");
    setHasChanges(false);
    localStorage.removeItem("team-organization-draft");
  }, []);

  const loadFromTemplate = useCallback(
    (groups: TableGroup[], teamDefs: TeamDefinition[]) => {
      const uniqueGroups = groups.map((g, index) => ({
        ...g,
        id:
          g.id ||
          `group-${Date.now()}-${index}-${Math.random()
            .toString(36)
            .slice(2, 11)}`,
        staffAssignments: g.staffAssignments || [],
      }));
      const uniqueTeams = teamDefs.map((t, index) => ({
        ...t,
        id:
          t.id ||
          `team-${Date.now()}-${index}-${Math.random()
            .toString(36)
            .slice(2, 11)}`,
      }));
      setTableGroups(uniqueGroups);
      setTeams(uniqueTeams);
      setIsInitialized(true);
      setHasChanges(false); // Yükleme sonrası değişiklik yok
    },
    [currentStep]
  );

  const loadDraft = useCallback(() => {
    const draft = localStorage.getItem("team-organization-draft");
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setTableGroups(parsed.tableGroups || []);
        setTeams(parsed.teams || []);
        setCurrentStep(parsed.currentStep || "table-grouping");
        return true;
      } catch (e) {
        console.error("Draft yüklenemedi:", e);
        return false;
      }
    }
    return false;
  }, []);

  // Summary Stats
  const stats = useMemo(() => {
    const totalTables = tableGroups.reduce(
      (sum, g) => sum + g.tableIds.length,
      0
    );
    const assignedGroups = tableGroups.filter((g) => g.assignedTeamId).length;
    const totalStaffAssigned = tableGroups.reduce(
      (sum, g) => sum + (g.staffAssignments?.length || 0),
      0
    );

    return {
      totalGroups: tableGroups.length,
      totalTables,
      totalTeams: teams.length,
      assignedGroups,
      unassignedGroups: tableGroups.length - assignedGroups,
      totalStaffAssigned,
      completionPercent:
        tableGroups.length > 0
          ? Math.round((assignedGroups / tableGroups.length) * 100)
          : 0,
    };
  }, [tableGroups, teams]);

  return {
    currentStep,
    tableGroups,
    teams,
    hasChanges,
    stats,
    lastDraftSave,
    currentStepIndex,
    canGoNext,
    canGoPrev,
    isInitialized,
    goToStep,
    goNext,
    goPrev,
    addTableGroup,
    updateTableGroup,
    deleteTableGroup,
    addTablesToGroup,
    removeTablesFromGroup,
    addTeam,
    updateTeam,
    deleteTeam,
    addStaffRequirement,
    removeStaffRequirement,
    applyRequirementsToAllTeams,
    assignGroupToTeam,
    unassignGroupFromTeam,
    mergeGroupsToTeam,
    assignStaffToGroup,
    removeStaffFromGroup,
    updateStaffAssignment,
    assignStaffToTeam,
    unassignStaffFromTeam,
    clearAll,
    loadFromTemplate,
    loadDraft,
    setHasChanges,
    setIsInitialized,
    hasUnassignedGroups,
  };
}
