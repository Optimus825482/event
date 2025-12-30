"use client";

import { memo } from "react";
import {
  Users,
  Edit2,
  Trash2,
  Crown,
  UserPlus,
  UserMinus,
  MoreVertical,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getAvatarUrl } from "../utils";
import type { Team, Staff } from "../types";

interface TeamCardProps {
  team: Team;
  isExpanded: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddMember: () => void;
  onRemoveMember: (memberId: string) => void;
  onSetLeader: (memberId: string) => void;
  onRemoveLeader: () => void;
}

export const TeamCard = memo(function TeamCard({
  team,
  isExpanded,
  isSelected,
  selectionMode,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
  onAddMember,
  onRemoveMember,
  onSetLeader,
  onRemoveLeader,
}: TeamCardProps) {
  const members = team.members || [];
  const leader = members.find((m) => m.id === team.leaderId);
  const memberCount = members.length || team.memberIds?.length || 0;

  const handleClick = () => {
    if (selectionMode) {
      onSelect();
    } else {
      onToggle();
    }
  };

  return (
    <div
      className={`bg-slate-800 border rounded-lg overflow-hidden transition-colors ${
        isSelected ? "border-blue-500 bg-blue-500/10" : "border-slate-700"
      }`}
    >
      {/* Team Header */}
      <div
        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
          selectionMode
            ? isSelected
              ? "bg-blue-500/20"
              : "hover:bg-slate-700/50"
            : "hover:bg-slate-700/50"
        }`}
        onClick={handleClick}
      >
        <div className="flex items-center gap-3">
          {selectionMode && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
              className="border-slate-500 data-[state=checked]:bg-blue-600"
            />
          )}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${team.color}30` }}
          >
            <Users className="w-4 h-4" style={{ color: team.color }} />
          </div>
          <div>
            <h3 className="font-medium text-white text-sm flex items-center gap-2">
              {team.name}
              {leader && (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  {leader.fullName}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">{memberCount} üye</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!selectionMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-slate-800 border-slate-700"
              >
                <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Düzenle
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onAddMember}
                  className="cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Üye Ekle
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="cursor-pointer text-red-400"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Badge
            variant="outline"
            className="text-sm min-w-[40px] justify-center"
            style={{
              backgroundColor: `${team.color}20`,
              color: team.color,
              borderColor: `${team.color}50`,
            }}
          >
            {memberCount}
          </Badge>
          {!selectionMode && (
            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          )}
        </div>
      </div>

      {/* Member List */}
      {isExpanded && !selectionMode && (
        <div className="border-t border-slate-700 bg-slate-800/50">
          {members.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              Bu ekipte henüz üye yok
              <Button
                variant="link"
                size="sm"
                onClick={onAddMember}
                className="text-blue-400 ml-2"
              >
                Üye Ekle
              </Button>
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-700/30 text-xs text-slate-400 font-medium sticky top-0">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Ad Soyad</div>
                <div className="col-span-3">Pozisyon</div>
                <div className="col-span-3 text-right">İşlemler</div>
              </div>
              {/* Member Rows */}
              {members.map((member, idx) => (
                <TeamMemberRow
                  key={member.id}
                  member={member}
                  index={idx}
                  isLeader={member.id === team.leaderId}
                  teamColor={team.color}
                  onSetLeader={() => onSetLeader(member.id)}
                  onRemoveLeader={onRemoveLeader}
                  onRemove={() => onRemoveMember(member.id)}
                />
              ))}
            </div>
          )}
          <div className="p-2 border-t border-slate-700">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-slate-600 bg-slate-700/30 h-8"
              onClick={onAddMember}
            >
              <UserPlus className="w-3 h-3 mr-2" />
              Üye Ekle
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

// Member Row Sub-component
interface TeamMemberRowProps {
  member: Staff;
  index: number;
  isLeader: boolean;
  teamColor: string;
  onSetLeader: () => void;
  onRemoveLeader: () => void;
  onRemove: () => void;
}

const TeamMemberRow = memo(function TeamMemberRow({
  member,
  index,
  isLeader,
  teamColor,
  onSetLeader,
  onRemoveLeader,
  onRemove,
}: TeamMemberRowProps) {
  return (
    <div
      className={`grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-slate-700/30 border-b border-slate-700/50 last:border-0 group ${
        isLeader ? "bg-amber-500/5" : ""
      }`}
    >
      <div className="col-span-1 text-xs text-slate-500">{index + 1}</div>
      <div className="col-span-5 flex items-center gap-2">
        <Avatar className="w-7 h-7">
          <AvatarImage src={getAvatarUrl(member.avatar)} />
          <AvatarFallback
            style={{ backgroundColor: member.color || teamColor }}
            className="text-white text-xs"
          >
            {member.fullName?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-white truncate flex items-center gap-1">
          {member.fullName}
          {isLeader && <Crown className="w-3 h-3 text-amber-400" />}
        </span>
      </div>
      <div className="col-span-3 text-xs text-slate-400">
        {member.position || "-"}
      </div>
      <div className="col-span-3 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
        {isLeader ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-amber-400 hover:text-slate-400"
                onClick={onRemoveLeader}
              >
                <Crown className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Liderlikten Çıkar</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-amber-400"
                onClick={onSetLeader}
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
              onClick={onRemove}
            >
              <UserMinus className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Çıkar</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});
