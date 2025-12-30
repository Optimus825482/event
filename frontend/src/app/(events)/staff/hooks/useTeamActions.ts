"use client";

import { useState, useCallback } from "react";
import { staffApi } from "@/lib/api";
import type { Team, Staff } from "../types";

interface UseTeamActionsProps {
  onTeamsChange: () => void | Promise<void>;
}

interface UseTeamActionsReturn {
  // State
  loading: boolean;
  deleteConfirm: Team | null;
  bulkDeleteConfirm: boolean;
  bulkDeleting: boolean;
  selectionMode: boolean;
  selectedTeams: Set<string>;

  // Actions
  setDeleteConfirm: (team: Team | null) => void;
  setBulkDeleteConfirm: (value: boolean) => void;
  setSelectionMode: (value: boolean) => void;
  toggleSelection: (teamId: string) => void;
  toggleSelectAll: (teamIds: string[]) => void;
  exitSelectionMode: () => void;

  // API Actions
  handleDeleteTeam: () => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleRemoveMember: (teamId: string, memberId: string) => Promise<void>;
  handleSetLeader: (teamId: string, memberId: string) => Promise<void>;
  handleRemoveLeader: (teamId: string) => Promise<void>;
  handleAddMembers: (teamId: string, memberIds: string[]) => Promise<boolean>;
}

export function useTeamActions({
  onTeamsChange,
}: UseTeamActionsProps): UseTeamActionsReturn {
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Team | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());

  // Selection helpers
  const toggleSelection = useCallback((teamId: string) => {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((teamIds: string[]) => {
    setSelectedTeams((prev) => {
      if (prev.size === teamIds.length) {
        return new Set();
      }
      return new Set(teamIds);
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedTeams(new Set());
  }, []);

  // Delete single team
  const handleDeleteTeam = useCallback(async () => {
    if (!deleteConfirm) return;
    try {
      setLoading(true);
      await staffApi.deleteTeam(deleteConfirm.id);
      setDeleteConfirm(null);
      await onTeamsChange();
    } catch (error) {
      console.error("Silme hatası:", error);
    } finally {
      setLoading(false);
    }
  }, [deleteConfirm, onTeamsChange]);

  // Bulk delete teams
  const handleBulkDelete = useCallback(async () => {
    if (selectedTeams.size === 0) return;
    try {
      setBulkDeleting(true);
      await staffApi.bulkDeleteTeams(Array.from(selectedTeams));
      setBulkDeleteConfirm(false);
      exitSelectionMode();
      await onTeamsChange();
    } catch (error) {
      console.error("Toplu silme hatası:", error);
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedTeams, exitSelectionMode, onTeamsChange]);

  // Remove member from team
  const handleRemoveMember = useCallback(
    async (teamId: string, memberId: string) => {
      try {
        await staffApi.removeMemberFromTeam(teamId, memberId);
        await onTeamsChange();
      } catch (error) {
        console.error("Üye çıkarma hatası:", error);
      }
    },
    [onTeamsChange]
  );

  // Set team leader
  const handleSetLeader = useCallback(
    async (teamId: string, memberId: string) => {
      try {
        await staffApi.setTeamLeader(teamId, memberId);
        await onTeamsChange();
      } catch (error) {
        console.error("Lider atama hatası:", error);
      }
    },
    [onTeamsChange]
  );

  // Remove leader
  const handleRemoveLeader = useCallback(
    async (teamId: string) => {
      try {
        await staffApi.setTeamLeader(teamId, null);
        await onTeamsChange();
      } catch (error) {
        console.error("Liderlikten çıkarma hatası:", error);
      }
    },
    [onTeamsChange]
  );

  // Add multiple members to team (bulk)
  const handleAddMembers = useCallback(
    async (teamId: string, memberIds: string[]): Promise<boolean> => {
      if (memberIds.length === 0) return false;
      try {
        setLoading(true);
        await staffApi.addMembersToTeamBulk(teamId, memberIds);
        await onTeamsChange();
        return true;
      } catch (error) {
        console.error("Üye ekleme hatası:", error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [onTeamsChange]
  );

  return {
    // State
    loading,
    deleteConfirm,
    bulkDeleteConfirm,
    bulkDeleting,
    selectionMode,
    selectedTeams,

    // Actions
    setDeleteConfirm,
    setBulkDeleteConfirm,
    setSelectionMode,
    toggleSelection,
    toggleSelectAll,
    exitSelectionMode,

    // API Actions
    handleDeleteTeam,
    handleBulkDelete,
    handleRemoveMember,
    handleSetLeader,
    handleRemoveLeader,
    handleAddMembers,
  };
}
