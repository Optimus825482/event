"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  X,
  Trash2,
} from "lucide-react";
import { staffApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeamFormModal } from "./TeamFormModal";
import { TeamCard } from "./TeamCard";
import { AddMemberModal } from "./AddMemberModal";
import { useTeamActions } from "../hooks/useTeamActions";
import type { Team, Staff } from "../types";

interface TeamsModuleProps {
  teams: Team[];
  onTeamsChange: () => void;
}

export function TeamsModule({ teams, onTeamsChange }: TeamsModuleProps) {
  // Staff list state
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Team actions hook
  const teamActions = useTeamActions({ onTeamsChange });

  // Load staff list
  useEffect(() => {
    const loadStaff = async () => {
      try {
        setLoading(true);
        const res = await staffApi.getPersonnel({ isActive: true });
        setStaffList(res.data || []);
      } catch (error) {
        console.error("Personel yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    };
    loadStaff();
  }, []);

  // Toggle team expand
  const toggleTeam = useCallback(
    (teamId: string) => {
      if (teamActions.selectionMode) return;
      setExpandedTeams((prev) => {
        const next = new Set(prev);
        if (next.has(teamId)) next.delete(teamId);
        else next.add(teamId);
        return next;
      });
    },
    [teamActions.selectionMode]
  );

  // Filtered teams
  const filteredTeams = useMemo(
    () =>
      teams.filter((team) =>
        team.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [teams, searchQuery]
  );

  // Handle add members
  const handleAddMembers = useCallback(
    async (teamId: string, memberIds: string[]): Promise<boolean> => {
      return teamActions.handleAddMembers(teamId, memberIds);
    },
    [teamActions]
  );

  // Stats
  const totalMembers = teams.reduce(
    (sum, t) => sum + (t.members?.length || t.memberIds?.length || 0),
    0
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full bg-slate-700 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {teamActions.selectionMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={teamActions.exitSelectionMode}
                className="border-slate-600"
              >
                <X className="w-4 h-4 mr-2" />
                İptal
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  teamActions.toggleSelectAll(filteredTeams.map((t) => t.id))
                }
                className="border-slate-600"
              >
                {teamActions.selectedTeams.size === filteredTeams.length ? (
                  <>
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Seçimi Kaldır
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Tümünü Seç
                  </>
                )}
              </Button>
              {teamActions.selectedTeams.size > 0 && (
                <Button
                  onClick={() => teamActions.setBulkDeleteConfirm(true)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {teamActions.selectedTeams.size} Ekibi Sil
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Yeni Şablon
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onTeamsChange}
                className="border-slate-600"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              {teams.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => teamActions.setSelectionMode(true)}
                  className="border-slate-600"
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Seç
                </Button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Ekip ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64 bg-slate-800 border-slate-700"
            />
          </div>
          <Badge
            variant="outline"
            className="bg-blue-500/20 text-blue-400 border-blue-500/30"
          >
            {teams.length} Şablon
          </Badge>
          <Badge
            variant="outline"
            className="bg-purple-500/20 text-purple-400 border-purple-500/30"
          >
            {totalMembers} Üye
          </Badge>
        </div>
      </div>

      {/* Selection mode info bar */}
      {teamActions.selectionMode && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-blue-400 text-sm">
            {teamActions.selectedTeams.size} şablon seçildi
          </span>
          <span className="text-slate-400 text-xs">
            Satırlara tıklayarak seçim yapabilirsiniz
          </span>
        </div>
      )}

      {/* Team List */}
      {filteredTeams.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
          <Users className="w-12 h-12 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 mb-4">
            {searchQuery
              ? "Arama kriterlerine uygun ekip şablonu bulunamadı"
              : "Henüz ekip şablonu oluşturulmamış"}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              İlk Şablonu Oluştur
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {filteredTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              isExpanded={expandedTeams.has(team.id)}
              isSelected={teamActions.selectedTeams.has(team.id)}
              selectionMode={teamActions.selectionMode}
              onToggle={() => toggleTeam(team.id)}
              onSelect={() => teamActions.toggleSelection(team.id)}
              onEdit={() => setEditingTeam(team)}
              onDelete={() => teamActions.setDeleteConfirm(team)}
              onAddMember={() => setAddMemberTeamId(team.id)}
              onRemoveMember={(memberId) =>
                teamActions.handleRemoveMember(team.id, memberId)
              }
              onSetLeader={(memberId) =>
                teamActions.handleSetLeader(team.id, memberId)
              }
              onRemoveLeader={() => teamActions.handleRemoveLeader(team.id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Team Modal */}
      <TeamFormModal
        open={showCreateModal || !!editingTeam}
        team={editingTeam}
        staffList={staffList}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTeam(null);
        }}
        onSave={async () => {
          setShowCreateModal(false);
          setEditingTeam(null);
          await onTeamsChange();
        }}
      />

      {/* Add Member Modal */}
      <AddMemberModal
        open={!!addMemberTeamId}
        teamId={addMemberTeamId}
        teams={teams}
        staffList={staffList}
        onClose={() => setAddMemberTeamId(null)}
        onAddMembers={handleAddMembers}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={!!teamActions.deleteConfirm}
        onOpenChange={() => teamActions.setDeleteConfirm(null)}
      >
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Ekibi Sil
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              <strong className="text-white">
                {teamActions.deleteConfirm?.name}
              </strong>{" "}
              ekibini silmek istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => teamActions.setDeleteConfirm(null)}
              className="border-slate-600"
            >
              İptal
            </Button>
            <Button
              onClick={teamActions.handleDeleteTeam}
              className="bg-red-600 hover:bg-red-700"
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog
        open={teamActions.bulkDeleteConfirm}
        onOpenChange={teamActions.setBulkDeleteConfirm}
      >
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Toplu Ekip Silme
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              <strong className="text-white">
                {teamActions.selectedTeams.size} ekip
              </strong>{" "}
              silmek istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => teamActions.setBulkDeleteConfirm(false)}
              className="border-slate-600"
              disabled={teamActions.bulkDeleting}
            >
              İptal
            </Button>
            <Button
              onClick={teamActions.handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={teamActions.bulkDeleting}
            >
              {teamActions.bulkDeleting
                ? "Siliniyor..."
                : `${teamActions.selectedTeams.size} Ekibi Sil`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
