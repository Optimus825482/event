"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Crown,
  UserPlus,
  UserMinus,
  Loader2,
  Check,
  MoreVertical,
} from "lucide-react";
import { staffApi, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Staff,
  ServiceTeam,
  TeamMember,
  POSITION_LABELS,
  POSITION_COLORS,
  DEFAULT_COLORS,
  StaffPosition,
} from "./types";

const getAvatarUrl = (avatar?: string): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith("http") || avatar.startsWith("data:")) return avatar;
  return `${API_BASE}${avatar}`;
};

interface TeamsTabProps {
  eventId: string;
  onTeamsChange?: () => void;
}

export function TeamsTab({ eventId, onTeamsChange }: TeamsTabProps) {
  const [teams, setTeams] = useState<ServiceTeam[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ServiceTeam | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ServiceTeam | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState<string | null>(
    null
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [teamsRes, staffRes] = await Promise.all([
        staffApi.getEventTeams(eventId),
        staffApi.getAll(true),
      ]);
      setTeams(teamsRes.data || []);
      setStaffList(staffRes.data || []);
    } catch (error) {
      console.error("Veri yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      loadData();
    }
  }, [eventId]);

  const handleDeleteTeam = async () => {
    if (!deleteConfirm) return;
    try {
      await staffApi.deleteTeam(deleteConfirm.id);
      setTeams((prev) => prev.filter((t) => t.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      onTeamsChange?.();
    } catch (error) {
      console.error("Silme hatası:", error);
    }
  };

  const handleRemoveMember = async (teamId: string, memberId: string) => {
    try {
      await staffApi.removeMemberFromTeam(teamId, memberId);
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId
            ? {
                ...t,
                members: t.members.filter((m) => m.id !== memberId),
                leaderId: t.leaderId === memberId ? undefined : t.leaderId,
              }
            : t
        )
      );
      onTeamsChange?.();
    } catch (error) {
      console.error("Üye çıkarma hatası:", error);
    }
  };

  const handleSetLeader = async (teamId: string, memberId: string) => {
    try {
      await staffApi.updateTeam(teamId, { leaderId: memberId });
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, leaderId: memberId } : t))
      );
      onTeamsChange?.();
    } catch (error) {
      console.error("Lider atama hatası:", error);
    }
  };

  const handleSaveTeam = () => {
    loadData();
    setShowCreateModal(false);
    setEditingTeam(null);
    onTeamsChange?.();
  };

  const handleAddMember = async (teamId: string, staff: Staff) => {
    try {
      const member: TeamMember = {
        id: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        color: staff.color,
        position: staff.position,
        avatar: staff.avatar,
      };
      await staffApi.addMemberToTeam(teamId, { memberId: staff.id });
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId ? { ...t, members: [...t.members, member] } : t
        )
      );
      setShowAddMemberModal(null);
      onTeamsChange?.();
    } catch (error) {
      console.error("Üye ekleme hatası:", error);
    }
  };

  // Ekipte olmayan personeller
  const getAvailableStaff = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return staffList;
    const memberIds = team.members.map((m) => m.id);
    return staffList.filter((s) => !memberIds.includes(s.id));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32 bg-slate-700" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-10 w-full bg-slate-700" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="bg-purple-500/20 text-purple-400 border-purple-500/30"
          >
            {teams.length} Ekip
          </Badge>
          <Badge
            variant="outline"
            className="bg-blue-500/20 text-blue-400 border-blue-500/30"
          >
            {teams.reduce((sum, t) => sum + t.members.length, 0)} Üye
          </Badge>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Yeni Ekip
        </Button>
      </div>

      {/* Ekip Listesi */}
      {teams.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 mb-4">Henüz ekip oluşturulmamış</p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            İlk Ekibi Oluştur
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => {
            const leader = team.members.find((m) => m.id === team.leaderId);
            return (
              <Card
                key={team.id}
                className="bg-slate-800 border-slate-700 overflow-hidden"
              >
                <div className="h-1" style={{ backgroundColor: team.color }} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="text-white">{team.name}</span>
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-slate-800 border-slate-700"
                      >
                        <DropdownMenuItem
                          onClick={() => setEditingTeam(team)}
                          className="cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setShowAddMemberModal(team.id)}
                          className="cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Üye Ekle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirm(team)}
                          className="cursor-pointer text-red-400 focus:text-red-400"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {leader && (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={getAvatarUrl(leader.avatar)} />
                        <AvatarFallback
                          style={{ backgroundColor: leader.color }}
                          className="text-white text-xs"
                        >
                          {leader.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-amber-400">
                        {leader.fullName}
                      </span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xs text-slate-400 mb-2">
                    {team.members.length} üye • {team.tableIds.length} masa
                  </div>
                  <ScrollArea className="h-[180px]">
                    <div className="space-y-1.5">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                            member.id === team.leaderId
                              ? "bg-amber-500/5"
                              : "bg-slate-700/30 hover:bg-slate-700/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={getAvatarUrl(member.avatar)} />
                              <AvatarFallback
                                style={{ backgroundColor: member.color }}
                                className="text-white text-xs"
                              >
                                {member.fullName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm text-white leading-tight">
                                {member.fullName}
                              </p>
                              {member.position && (
                                <span className="text-xs text-slate-400">
                                  {POSITION_LABELS[member.position]}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {member.id !== team.leaderId && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-slate-400 hover:text-amber-400"
                                    onClick={() =>
                                      handleSetLeader(team.id, member.id)
                                    }
                                  >
                                    <Crown className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Lider Yap</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-slate-400 hover:text-red-400"
                                  onClick={() =>
                                    handleRemoveMember(team.id, member.id)
                                  }
                                >
                                  <UserMinus className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Çıkar</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                      {team.members.length === 0 && (
                        <div className="text-center py-4 text-slate-500 text-sm">
                          Henüz üye yok
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 border-slate-600 bg-slate-700/30 h-8"
                    onClick={() => setShowAddMemberModal(team.id)}
                  >
                    <UserPlus className="w-3 h-3 mr-2" />
                    Üye Ekle
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {/* Yeni Ekip Kartı */}
          <Card
            className="bg-slate-800/30 border-slate-700 border-dashed cursor-pointer hover:bg-slate-800/50 transition-colors"
            onClick={() => setShowCreateModal(true)}
          >
            <CardContent className="flex flex-col items-center justify-center h-full min-h-[280px]">
              <Plus className="w-10 h-10 text-slate-500 mb-2" />
              <p className="text-slate-400">Yeni Ekip Oluştur</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create/Edit Team Modal */}
      <TeamFormDialog
        open={showCreateModal || !!editingTeam}
        team={editingTeam}
        eventId={eventId}
        staffList={staffList}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTeam(null);
        }}
        onSave={handleSaveTeam}
      />

      {/* Add Member Modal */}
      <Dialog
        open={!!showAddMemberModal}
        onOpenChange={() => setShowAddMemberModal(null)}
      >
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle>Üye Ekle</DialogTitle>
            <DialogDescription className="text-slate-400">
              Ekibe eklenecek personeli seçin
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 py-2">
              {showAddMemberModal &&
                getAvailableStaff(showAddMemberModal).map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 cursor-pointer transition-colors"
                    onClick={() => handleAddMember(showAddMemberModal, staff)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={getAvatarUrl(staff.avatar)} />
                        <AvatarFallback
                          style={{ backgroundColor: staff.color }}
                          className="text-white"
                        >
                          {staff.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {staff.fullName}
                        </p>
                        {staff.position && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              POSITION_COLORS[staff.position]
                            }`}
                          >
                            {POSITION_LABELS[staff.position]}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              {showAddMemberModal &&
                getAvailableStaff(showAddMemberModal).length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    Eklenebilecek personel kalmadı
                  </div>
                )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle>Ekibi Sil</DialogTitle>
            <DialogDescription className="text-slate-400">
              <strong>{deleteConfirm?.name}</strong> ekibini silmek
              istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="border-slate-600"
            >
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDeleteTeam}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Team Form Dialog
function TeamFormDialog({
  open,
  team,
  eventId,
  staffList,
  onClose,
  onSave,
}: {
  open: boolean;
  team: ServiceTeam | null;
  eventId: string;
  staffList: Staff[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    color: "#3b82f6",
    leaderId: "",
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (team) {
        setFormData({
          name: team.name,
          color: team.color,
          leaderId: team.leaderId || "",
        });
        setSelectedMembers(team.members.map((m) => m.id));
      } else {
        setFormData({
          name: "",
          color:
            DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
          leaderId: "",
        });
        setSelectedMembers([]);
      }
      setError("");
    }
  }, [open, team]);

  const toggleMember = (staffId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Ekip adı zorunludur");
      return;
    }

    setSaving(true);
    try {
      // memberIds array'i oluştur
      const memberIds = selectedMembers;

      if (team) {
        await staffApi.updateTeam(team.id, {
          name: formData.name,
          color: formData.color,
          leaderId: formData.leaderId || undefined,
          memberIds,
        });
      } else {
        await staffApi.createTeam({
          name: formData.name,
          color: formData.color,
          leaderId: formData.leaderId || undefined,
          memberIds,
        });
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  };

  // Lider adayları (süpervizör ve şefler)
  const leaderCandidates = staffList.filter(
    (s) =>
      selectedMembers.includes(s.id) &&
      (s.position === "supervizor" || s.position === "sef")
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle>{team ? "Ekip Düzenle" : "Yeni Ekip"}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Ekip bilgilerini ve üyelerini belirleyin
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Ekip Adı *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Örn: A Takımı"
                className="bg-slate-700 border-slate-600 h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ekip Rengi</Label>
              <div className="flex gap-1 flex-wrap">
                {DEFAULT_COLORS.slice(0, 8).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      formData.color === color
                        ? "border-white scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {formData.color === color && (
                      <Check className="w-3 h-3 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {leaderCandidates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Ekip Lideri</Label>
              <div className="flex gap-2 flex-wrap">
                {leaderCandidates.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        leaderId:
                          formData.leaderId === staff.id ? "" : staff.id,
                      })
                    }
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                      formData.leaderId === staff.id
                        ? "border-amber-500 bg-amber-500/20"
                        : "border-slate-600 bg-slate-700/50 hover:bg-slate-700"
                    }`}
                  >
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={getAvatarUrl(staff.avatar)} />
                      <AvatarFallback
                        style={{ backgroundColor: staff.color }}
                        className="text-white text-xs"
                      >
                        {staff.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-white">{staff.fullName}</span>
                    {formData.leaderId === staff.id && (
                      <Crown className="w-3 h-3 text-amber-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">
              Üyeler ({selectedMembers.length} seçili)
            </Label>
            <ScrollArea className="h-[200px] border border-slate-700 rounded-lg p-2">
              <div className="space-y-1">
                {staffList.map((staff) => (
                  <div
                    key={staff.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedMembers.includes(staff.id)
                        ? "bg-purple-500/20 border border-purple-500/30"
                        : "bg-slate-700/30 hover:bg-slate-700/50"
                    }`}
                    onClick={() => toggleMember(staff.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={getAvatarUrl(staff.avatar)} />
                        <AvatarFallback
                          style={{ backgroundColor: staff.color }}
                          className="text-white text-xs"
                        >
                          {staff.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm text-white">{staff.fullName}</p>
                        {staff.position && (
                          <span className="text-xs text-slate-400">
                            {POSITION_LABELS[staff.position]}
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedMembers.includes(staff.id) && (
                      <Check className="w-4 h-4 text-purple-400" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-600"
              disabled={saving}
            >
              İptal
            </Button>
            <Button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {team ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
