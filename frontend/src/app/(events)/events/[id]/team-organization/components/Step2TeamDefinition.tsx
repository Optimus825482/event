"use client";

import { useState, useCallback, memo } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Users,
  UserPlus,
  AlertCircle,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  TeamDefinition,
  TeamStaffRequirement,
  StaffRole,
  STAFF_ROLES,
  DEFAULT_COLORS,
} from "../types";
import { cn } from "@/lib/utils";

interface Step2TeamDefinitionProps {
  teams: TeamDefinition[];
  onAddTeam: (name: string, color?: string) => TeamDefinition;
  onUpdateTeam: (teamId: string, updates: Partial<TeamDefinition>) => void;
  onDeleteTeam: (teamId: string) => void;
  onAddStaffRequirement: (
    teamId: string,
    role: StaffRole,
    count: number
  ) => void;
  onRemoveStaffRequirement: (teamId: string, role: StaffRole) => void;
  onApplyToAllTeams?: (sourceTeamId: string) => void;
}

// ==================== TEAM CARD COMPONENT ====================
interface TeamCardProps {
  team: TeamDefinition;
  isFirstWithRequirements: boolean;
  totalTeams: number;
  onEdit: (teamId: string, updates: Partial<TeamDefinition>) => void;
  onDelete: (teamId: string) => void;
  onAddRequirement: (teamId: string, role: StaffRole, count: number) => void;
  onRemoveRequirement: (teamId: string, role: StaffRole) => void;
  onApplyToAll?: (teamId: string) => void;
}

const TeamCard = memo(function TeamCard({
  team,
  isFirstWithRequirements,
  totalTeams,
  onEdit,
  onDelete,
  onAddRequirement,
  onRemoveRequirement,
  onApplyToAll,
}: TeamCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(team.name);
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState<StaffRole>("waiter");
  const [newRoleCount, setNewRoleCount] = useState(1);

  // Available roles (not already added)
  const availableRoles = STAFF_ROLES.filter(
    (role) => !team.requiredStaff.some((r) => r.role === role.value)
  );

  const handleSaveEdit = useCallback(() => {
    if (editName.trim()) {
      onEdit(team.id, { name: editName.trim() });
    }
    setIsEditing(false);
  }, [editName, team.id, onEdit]);

  const handleAddRole = useCallback(() => {
    if (newRoleCount > 0) {
      onAddRequirement(team.id, newRole, newRoleCount);
      setShowAddRole(false);
      setNewRoleCount(1);
    }
  }, [team.id, newRole, newRoleCount, onAddRequirement]);

  const handleUpdateRoleCount = useCallback(
    (role: StaffRole, count: number) => {
      if (count <= 0) {
        onRemoveRequirement(team.id, role);
      } else {
        onAddRequirement(team.id, role, count);
      }
    },
    [team.id, onAddRequirement, onRemoveRequirement]
  );

  const totalRequired = team.requiredStaff.reduce((sum, r) => sum + r.count, 0);
  const totalAssigned = team.requiredStaff.reduce(
    (sum, r) => sum + r.assignedStaffIds.length,
    0
  );

  return (
    <div
      className="bg-slate-800/50 rounded-lg border-2 p-4 transition-all hover:bg-slate-800"
      style={{ borderColor: team.color }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 w-32 text-sm bg-slate-700 border-slate-600"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") setIsEditing(false);
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-400"
                onClick={handleSaveEdit}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-400"
                onClick={() => setIsEditing(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <span className="font-semibold text-white">{team.name}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isEditing && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-400 hover:text-white"
                onClick={() => {
                  setEditName(team.name);
                  setIsEditing(true);
                }}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-400 hover:text-red-400"
                onClick={() => onDelete(team.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Staff Requirements */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Personel Gereksinimleri
          </span>
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              totalAssigned >= totalRequired
                ? "bg-emerald-600/20 text-emerald-400"
                : "bg-amber-600/20 text-amber-400"
            )}
          >
            {totalAssigned}/{totalRequired}
          </Badge>
        </div>

        {team.requiredStaff.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            Henüz personel gereksinimi eklenmedi
          </p>
        ) : (
          <div className="space-y-1.5">
            {team.requiredStaff.map((req) => {
              const roleInfo = STAFF_ROLES.find((r) => r.value === req.role);
              return (
                <div
                  key={req.role}
                  className="flex items-center justify-between bg-slate-700/50 rounded px-2 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: roleInfo?.color }}
                    />
                    <span className="text-sm text-slate-300">
                      {roleInfo?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-slate-400"
                      onClick={() =>
                        handleUpdateRoleCount(req.role, req.count - 1)
                      }
                    >
                      -
                    </Button>
                    <span className="text-sm text-white w-6 text-center">
                      {req.count}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-slate-400"
                      onClick={() =>
                        handleUpdateRoleCount(req.role, req.count + 1)
                      }
                    >
                      +
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-slate-400 hover:text-red-400"
                      onClick={() => onRemoveRequirement(team.id, req.role)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Role */}
        {showAddRole ? (
          <div className="flex items-center gap-2 mt-2">
            <Select
              value={newRole}
              onValueChange={(v) => setNewRole(v as StaffRole)}
            >
              <SelectTrigger className="h-8 flex-1 bg-slate-700 border-slate-600 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {availableRoles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      {role.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              value={newRoleCount}
              onChange={(e) => setNewRoleCount(parseInt(e.target.value) || 1)}
              className="h-8 w-16 bg-slate-700 border-slate-600 text-sm"
            />
            <Button
              size="sm"
              className="h-8 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleAddRole}
              disabled={availableRoles.length === 0}
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => setShowAddRole(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          availableRoles.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-8 text-xs text-slate-400 hover:text-white border border-dashed border-slate-600"
              onClick={() => setShowAddRole(true)}
            >
              <UserPlus className="w-3 h-3 mr-1" />
              Rol Ekle
            </Button>
          )
        )}
      </div>

      {/* Apply to All Teams Button */}
      {isFirstWithRequirements &&
        totalTeams > 1 &&
        team.requiredStaff.length > 0 &&
        onApplyToAll && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                    onClick={() => onApplyToAll(team.id)}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Tüm Takımlara Uygula
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Bu takımın rol yapısını diğer tüm takımlara kopyala
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

      {/* Assigned Groups Info */}
      {team.assignedGroupIds.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <span className="text-xs text-slate-400">
            {team.assignedGroupIds.length} grup atandı
          </span>
        </div>
      )}
    </div>
  );
});

// ==================== MAIN COMPONENT ====================
export function Step2TeamDefinition({
  teams,
  onAddTeam,
  onUpdateTeam,
  onDeleteTeam,
  onAddStaffRequirement,
  onRemoveStaffRequirement,
  onApplyToAllTeams,
}: Step2TeamDefinitionProps) {
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState(DEFAULT_COLORS[0]);

  const handleCreateTeam = useCallback(() => {
    if (!newTeamName.trim()) return;

    onAddTeam(newTeamName.trim(), newTeamColor);
    setShowNewTeamModal(false);
    setNewTeamName("");
    setNewTeamColor(DEFAULT_COLORS[(teams.length + 1) % DEFAULT_COLORS.length]);
  }, [newTeamName, newTeamColor, teams.length, onAddTeam]);

  const totalStaffRequired = teams.reduce(
    (sum, t) => sum + t.requiredStaff.reduce((s, r) => s + r.count, 0),
    0
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Takım Tanımlama</h2>
          <p className="text-sm text-slate-400">
            Etkinlik için takımları ve personel gereksinimlerini belirleyin
          </p>
        </div>
        <Button
          onClick={() => {
            setNewTeamColor(
              DEFAULT_COLORS[teams.length % DEFAULT_COLORS.length]
            );
            setShowNewTeamModal(true);
          }}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Yeni Takım
        </Button>
      </div>

      {/* Teams Grid */}
      <div className="flex-1 overflow-y-auto">
        {teams.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
            <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <h3 className="text-white font-medium mb-1">Henüz takım yok</h3>
            <p className="text-sm text-slate-400 mb-4">
              Etkinlik için takımlar oluşturun ve personel gereksinimlerini
              belirleyin
            </p>
            <Button
              onClick={() => setShowNewTeamModal(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              İlk Takımı Oluştur
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team, index) => {
              // İlk rol tanımlı takımı bul
              const firstTeamWithRequirements = teams.find(
                (t) => t.requiredStaff.length > 0
              );
              const isFirstWithRequirements =
                firstTeamWithRequirements?.id === team.id;

              return (
                <TeamCard
                  key={team.id}
                  team={team}
                  isFirstWithRequirements={isFirstWithRequirements}
                  totalTeams={teams.length}
                  onEdit={onUpdateTeam}
                  onDelete={onDeleteTeam}
                  onAddRequirement={onAddStaffRequirement}
                  onRemoveRequirement={onRemoveStaffRequirement}
                  onApplyToAll={onApplyToAllTeams}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {teams.length > 0 && (
        <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400">
              <span className="text-white font-medium">{teams.length}</span>{" "}
              takım
            </span>
            <span className="text-slate-400">
              <span className="text-white font-medium">
                {totalStaffRequired}
              </span>{" "}
              personel gerekli
            </span>
          </div>
          {teams.some((t) => t.requiredStaff.length === 0) && (
            <div className="flex items-center gap-1 text-amber-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              Bazı takımların personel gereksinimi yok
            </div>
          )}
        </div>
      )}

      {/* New Team Modal */}
      <Dialog open={showNewTeamModal} onOpenChange={setShowNewTeamModal}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Yeni Takım Oluştur</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">
                Takım Adı
              </label>
              <Input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Örn: A Takımı, VIP Ekibi"
                className="bg-slate-700 border-slate-600"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateTeam();
                }}
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                Takım Rengi
              </label>
              <div className="grid grid-cols-8 gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                      newTeamColor === color
                        ? "border-white scale-110"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTeamColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewTeamModal(false)}
              className="border-slate-600"
            >
              İptal
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={!newTeamName.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="w-4 h-4 mr-1" />
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
