"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Phone,
  Mail,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Progress } from "@/components/ui/progress";
import { leaderApi, API_BASE } from "@/lib/api";
import { useToast } from "@/components/ui/toast-notification";

interface TeamMember {
  id: string;
  fullName: string;
  avatar?: string;
  position?: string;
  color?: string;
  phone?: string;
  email?: string;
}

interface Team {
  id: string;
  name: string;
  color: string;
  members: TeamMember[];
  memberCount?: number;
}

const positionLabels: Record<string, string> = {
  supervizor: "Süpervizör",
  sef: "Şef",
  garson: "Garson",
  komi: "Komi",
  debarasor: "Debarasör",
};

export default function LeaderTeamPage() {
  const router = useRouter();
  const toast = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadTeams = useCallback(async () => {
    try {
      setLoading(true);
      const res = await leaderApi.getDashboard();
      setTeams(res.data.teams || []);

      // Tüm üyeleri topla
      const members: TeamMember[] = [];
      res.data.teams?.forEach((team: Team) => {
        team.members?.forEach((member) => {
          if (!members.find((m) => m.id === member.id)) {
            members.push(member);
          }
        });
      });
      setAllMembers(members);
    } catch (error) {
      console.error("Ekip bilgileri yüklenemedi:", error);
      toast.error("Ekip bilgileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const filteredMembers = allMembers.filter((m) =>
    m.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 bg-slate-700" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 bg-slate-700 rounded-lg" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="Ekip"
          description="Takımlarınız ve ekip üyeleriniz"
          icon={<Users className="w-6 h-6 text-cyan-400" />}
        />

        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {teams.length}
                </div>
                <div className="text-xs text-slate-400">Takım</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Award className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {allMembers.length}
                </div>
                <div className="text-xs text-slate-400">Toplam Üye</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Takımlar */}
        {teams.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Takımlarım</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map((team) => (
                <Card
                  key={team.id}
                  className="bg-slate-800/50 border-slate-700"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <CardTitle className="text-lg text-white">
                        {team.name}
                      </CardTitle>
                      <Badge variant="outline" className="ml-auto">
                        {team.members?.length || 0} üye
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {team.members?.slice(0, 8).map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors"
                          onClick={() =>
                            router.push(`/leader/team/${member.id}`)
                          }
                        >
                          <Avatar className="w-8 h-8">
                            {member.avatar && (
                              <AvatarImage
                                src={`${API_BASE}${member.avatar}`}
                              />
                            )}
                            <AvatarFallback
                              style={{
                                backgroundColor: member.color || "#3b82f6",
                              }}
                              className="text-white text-xs"
                            >
                              {member.fullName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm text-white">
                              {member.fullName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {positionLabels[member.position || ""] ||
                                member.position ||
                                "Personel"}
                            </p>
                          </div>
                        </div>
                      ))}
                      {(team.members?.length || 0) > 8 && (
                        <div className="flex items-center justify-center p-2 bg-slate-700/50 rounded-lg text-slate-400 text-sm">
                          +{(team.members?.length || 0) - 8} kişi
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tüm Ekip Üyeleri */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Tüm Ekip Üyeleri
            </h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Üye ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700"
              />
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
              <p className="text-slate-400">Ekip üyesi bulunamadı</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map((member) => (
                <Card
                  key={member.id}
                  className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all cursor-pointer group"
                  onClick={() => router.push(`/leader/team/${member.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-14 h-14 border-2 border-slate-600">
                        {member.avatar && (
                          <AvatarImage src={`${API_BASE}${member.avatar}`} />
                        )}
                        <AvatarFallback
                          style={{ backgroundColor: member.color || "#3b82f6" }}
                          className="text-white text-lg"
                        >
                          {member.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">
                          {member.fullName}
                        </p>
                        <p className="text-sm text-slate-400">
                          {positionLabels[member.position || ""] ||
                            member.position ||
                            "Personel"}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
