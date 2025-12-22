"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Users,
  Loader2,
  Check,
  Save,
  Trash2,
  Calendar,
  Clock,
  UserPlus,
  X,
} from "lucide-react";
import { eventsApi, staffApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/PageContainer";
import { useToast } from "@/components/ui/toast-notification";

// ==================== TYPES ====================
interface Event {
  id: string;
  name: string;
  eventDate: string;
  eventType?: string;
  staffAssignments?: StaffAssignment[];
}

interface Staff {
  id: string;
  fullName: string;
  position: string;
  color?: string;
  isActive: boolean;
}

interface StaffAssignment {
  id: string;
  staffId: string;
  staff?: Staff;
  role?: string;
}

// ==================== MAIN COMPONENT ====================
export default function TeamAssignmentPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [assignedStaffIds, setAssignedStaffIds] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ==================== DATA FETCHING ====================
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventRes, staffRes] = await Promise.all([
          eventsApi.getOne(eventId),
          staffApi.getAll().catch(() => ({ data: [] })),
        ]);

        setEvent(eventRes.data);
        setAllStaff(staffRes.data?.filter((s: Staff) => s.isActive) || []);

        // Mevcut atamalar
        if (eventRes.data?.staffAssignments) {
          const ids = new Set<string>(
            eventRes.data.staffAssignments.map(
              (a: StaffAssignment) => a.staffId
            )
          );
          setAssignedStaffIds(ids);
        }
      } catch (error) {
        toast.error("Veriler yüklenemedi");
        router.push("/events");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  // ==================== HANDLERS ====================
  const toggleStaff = (staffId: string) => {
    const newSet = new Set(assignedStaffIds);
    if (newSet.has(staffId)) {
      newSet.delete(staffId);
    } else {
      newSet.add(staffId);
    }
    setAssignedStaffIds(newSet);
  };

  const saveAssignments = async () => {
    setSaving(true);
    try {
      // staffApi.saveAssignments kullan - her personele boş tableIds ile kaydet
      const assignments = Array.from(assignedStaffIds).map((staffId) => ({
        staffId,
        tableIds: [] as string[], // Masa ataması venue planner'da yapılacak
      }));
      await staffApi.saveAssignments(eventId, assignments);
      toast.success("Ekip atamaları kaydedildi");
    } catch (error) {
      toast.error("Kaydetme başarısız");
    } finally {
      setSaving(false);
    }
  };

  const selectAll = () => {
    setAssignedStaffIds(new Set(allStaff.map((s) => s.id)));
  };

  const clearAll = () => {
    setAssignedStaffIds(new Set());
  };

  // ==================== RENDER ====================
  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64 bg-slate-700" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 bg-slate-700" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!event) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-slate-400">Etkinlik bulunamadı</p>
          <Button asChild className="mt-4">
            <Link href="/events">Etkinliklere Dön</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  const assignedStaff = allStaff.filter((s) => assignedStaffIds.has(s.id));
  const unassignedStaff = allStaff.filter((s) => !assignedStaffIds.has(s.id));

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">{event.name}</h1>
              <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(event.eventDate).toLocaleDateString("tr-TR")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {new Date(event.eventDate).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
              <Users className="w-4 h-4 mr-1" />
              {assignedStaffIds.size} Personel
            </Badge>
            <Button
              onClick={saveAssignments}
              disabled={saving}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Kaydet
            </Button>
          </div>
        </div>

        {allStaff.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 mb-4">Henüz personel eklenmemiş</p>
              <Button asChild>
                <Link href="/staff">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Personel Ekle
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Sol - Atanmış Personel */}
            <div className="col-span-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-400" />
                      Atanmış Personel ({assignedStaff.length})
                    </CardTitle>
                    {assignedStaff.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={clearAll}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Temizle
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {assignedStaff.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      Henüz personel atanmadı
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {assignedStaff.map((staff) => (
                        <div
                          key={staff.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                              style={{
                                backgroundColor: staff.color || "#8b5cf6",
                              }}
                            >
                              {staff.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-white">
                                {staff.fullName}
                              </p>
                              <p className="text-xs text-slate-400 capitalize">
                                {staff.position || "Personel"}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => toggleStaff(staff.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sağ - Mevcut Personel */}
            <div className="col-span-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      Mevcut Personel ({unassignedStaff.length})
                    </CardTitle>
                    {unassignedStaff.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-emerald-400 hover:text-emerald-300"
                        onClick={selectAll}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Tümünü Ekle
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {unassignedStaff.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      Tüm personel atandı
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {unassignedStaff.map((staff) => (
                        <div
                          key={staff.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors cursor-pointer"
                          onClick={() => toggleStaff(staff.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                              style={{
                                backgroundColor: staff.color || "#8b5cf6",
                              }}
                            >
                              {staff.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-white">
                                {staff.fullName}
                              </p>
                              <p className="text-xs text-slate-400 capitalize">
                                {staff.position || "Personel"}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
