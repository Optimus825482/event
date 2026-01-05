"use client";

import { useState, useEffect, useCallback } from "react";
import {
  eventsApi,
  staffApi,
  servicePointsApi,
  eventExtraStaffApi,
  clearApiCache,
} from "@/lib/api";
import {
  EventData,
  Staff,
  TableData,
  TableGroup,
  TeamDefinition,
  StageElement,
  WorkShift,
  ServicePoint,
} from "../types";

// Ekstra personel tipi
export interface ExtraStaff {
  id: string;
  fullName: string;
  position?: string;
  role?: string;
  shiftStart?: string;
  shiftEnd?: string;
  color?: string;
  notes?: string;
  assignedGroups?: string[];
  assignedTables?: string[];
  sortOrder?: number;
  isActive?: boolean;
  // Frontend için ek alanlar
  workLocation?: string;
}

interface UseOrganizationDataReturn {
  event: EventData | null;
  tables: TableData[];
  stageElements: StageElement[];
  allStaff: Staff[];
  eventShifts: WorkShift[];
  existingGroups: TableGroup[];
  existingTeams: TeamDefinition[];
  servicePoints: ServicePoint[];
  extraStaffList: ExtraStaff[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  saveOrganization: (
    groups: TableGroup[],
    teams: TeamDefinition[],
    extraStaff?: ExtraStaff[]
  ) => Promise<boolean>;
  // Extra Staff CRUD
  setExtraStaffList: React.Dispatch<React.SetStateAction<ExtraStaff[]>>;
  // Service Points CRUD
  addServicePoint: (data: {
    name: string;
    pointType: string;
    requiredStaffCount: number;
    allowedRoles: string[];
    color: string;
    description?: string;
  }) => Promise<ServicePoint | null>;
  updateServicePoint: (
    id: string,
    data: Partial<ServicePoint>
  ) => Promise<boolean>;
  deleteServicePoint: (id: string) => Promise<boolean>;
  // Service Point Staff Assignment
  assignStaffToServicePoint: (
    servicePointId: string,
    staffId: string,
    role: string,
    shiftStart: string,
    shiftEnd: string
  ) => Promise<boolean>;
  removeStaffFromServicePoint: (
    servicePointId: string,
    assignmentId: string
  ) => Promise<boolean>;
  saveServicePointStaffAssignments: (
    servicePointId: string,
    assignments: Array<{
      id?: string;
      staffId: string;
      role: string;
      shiftId?: string;
      shiftStart: string;
      shiftEnd: string;
    }>
  ) => Promise<boolean>;
}

export function useOrganizationData(
  eventId: string
): UseOrganizationDataReturn {
  const [event, setEvent] = useState<EventData | null>(null);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [eventShifts, setEventShifts] = useState<WorkShift[]>([]);
  const [existingGroups, setExistingGroups] = useState<TableGroup[]>([]);
  const [existingTeams, setExistingTeams] = useState<TeamDefinition[]>([]);
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [extraStaffList, setExtraStaffList] = useState<ExtraStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Masaları event'ten çıkar
  const tables: TableData[] = (() => {
    if (!event?.venueLayout) return [];
    const rawTables =
      event.venueLayout.tables || event.venueLayout.placedTables || [];
    return rawTables.map((t: any) => ({
      id: t.id,
      label: t.tableNumber?.toString() || t.label || "",
      x: t.x || 0,
      y: t.y || 0,
      typeName: t.typeName || t.type,
      type: t.type,
      color: t.color,
      capacity: t.capacity,
      isLoca: t.isLoca || false,
      locaName: t.locaName,
    }));
  })();

  // Sahne elementlerini event'ten çıkar
  const stageElements: StageElement[] = (() => {
    if (!event?.venueLayout?.stageElements) return [];
    return event.venueLayout.stageElements.map((s: any) => ({
      id: s.id,
      type: s.type,
      x: s.x || 0,
      y: s.y || 0,
      width: s.width || 100,
      height: s.height || 50,
      label: s.label || s.type,
      isLocked: s.isLocked,
    }));
  })();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Önce kritik verileri yükle (event + staff)
      const [eventRes, staffRes] = await Promise.all([
        eventsApi.getOne(eventId),
        staffApi.getPersonnel({ isActive: true }, true),
      ]);

      // Sonra event'e bağlı verileri yükle (rate limiting'i önlemek için)
      const [shiftsRes, servicePointsRes, extraStaffRes] = await Promise.all([
        staffApi.getEventShifts(eventId).catch(() => ({ data: [] })),
        servicePointsApi.getAll(eventId).catch(() => ({ data: [] })),
        eventExtraStaffApi.getAll(eventId).catch(() => ({ data: [] })),
      ]);

      setEvent(eventRes.data);
      setAllStaff(staffRes.data || []);
      setEventShifts(shiftsRes.data || []);
      setServicePoints(servicePointsRes.data || []);

      // Ekstra personelleri yükle ve frontend formatına dönüştür
      const loadedExtraStaff: ExtraStaff[] = (extraStaffRes.data || []).map(
        (es: any) => ({
          id: es.id,
          fullName: es.fullName,
          position: es.position,
          role: es.role,
          shiftStart: es.shiftStart,
          shiftEnd: es.shiftEnd,
          color: es.color,
          notes: es.notes,
          assignedGroups: es.assignedGroups,
          assignedTables: es.assignedTables,
          sortOrder: es.sortOrder,
          isActive: es.isActive,
          workLocation: "Ekstra Personel",
        })
      );
      setExtraStaffList(loadedExtraStaff);

      // Mevcut grupları, takımları ve personel atamalarını yükle
      try {
        const [groupsRes, teamsRes, assignmentsRes] = await Promise.all([
          staffApi.getEventTableGroups(eventId),
          // Etkinliğe özel takımları getir (global takımlar değil!)
          staffApi.getEventTeams(eventId).catch(() => ({ data: [] })),
          staffApi
            .getEventStaffAssignments(eventId)
            .catch(() => ({ data: [] })),
        ]);

        // Personel atamalarını tableId bazlı map'e dönüştür
        const assignmentsByTable = new Map<string, any[]>();
        (assignmentsRes.data || []).forEach((assignment: any) => {
          if (assignment.tableIds && assignment.tableIds.length > 0) {
            assignment.tableIds.forEach((tableId: string) => {
              if (!assignmentsByTable.has(tableId)) {
                assignmentsByTable.set(tableId, []);
              }
              assignmentsByTable.get(tableId)!.push(assignment);
            });
          }
        });

        // Backend'den gelen grupları dönüştür ve staffAssignments ekle
        const groups: TableGroup[] = (groupsRes.data || []).map((g: any) => {
          // Bu grubun masalarına atanmış personelleri bul
          const groupStaffAssignments: any[] = [];
          const seenStaffIds = new Set<string>();

          (g.tableIds || []).forEach((tableId: string) => {
            const tableAssignments = assignmentsByTable.get(tableId) || [];
            tableAssignments.forEach((assignment: any) => {
              // Aynı personeli birden fazla ekleme
              if (!seenStaffIds.has(assignment.staffId)) {
                seenStaffIds.add(assignment.staffId);
                const staff = staffRes.data?.find(
                  (s: any) => s.id === assignment.staffId
                );

                // Position'ı StaffRole'a çevir
                const positionToRole = (pos: string | undefined): string => {
                  if (!pos) return "waiter";
                  const p = pos.toLowerCase();
                  if (p.includes("süpervizör") || p.includes("supervisor"))
                    return "supervisor";
                  if (
                    p.includes("kaptan") ||
                    p.includes("captain") ||
                    p.includes("şef")
                  )
                    return "captain";
                  if (
                    p.includes("komi") ||
                    p.includes("runner") ||
                    p.includes("commis")
                  )
                    return "runner";
                  if (p.includes("hostes") || p.includes("hostess"))
                    return "hostess";
                  if (
                    p.includes("barmen") ||
                    p.includes("barman") ||
                    p.includes("bartender")
                  )
                    return "barman";
                  return "waiter"; // Garson varsayılan
                };

                groupStaffAssignments.push({
                  id: assignment.id,
                  staffId: assignment.staffId,
                  staffName:
                    staff?.fullName ||
                    assignment.staff?.fullName ||
                    "Bilinmeyen",
                  staffColor: assignment.color || staff?.color || "#3b82f6",
                  role: positionToRole(staff?.position),
                  shiftStart: assignment.shiftStart || "18:00",
                  shiftEnd: assignment.shiftEnd || "02:00",
                });
              }
            });
          });

          return {
            id: g.id,
            name: g.name,
            color: g.color,
            tableIds: g.tableIds || [],
            assignedTeamId: g.assignedTeamId,
            staffAssignments: groupStaffAssignments,
          };
        });
        setExistingGroups(groups);

        // Backend'den gelen takımları dönüştür
        // tableIds -> assignedGroupIds eşleştirmesi yap
        const teams: TeamDefinition[] = (teamsRes.data || []).map((t: any) => {
          // Takımın tableIds'inden hangi gruplara ait olduğunu bul
          const assignedGroupIds: string[] = [];
          const teamTableIds = t.tableIds || [];

          groups.forEach((group) => {
            // Grup masalarından herhangi biri takımın masalarında varsa, bu grup takıma ait
            const hasCommonTable = group.tableIds.some((tid: string) =>
              teamTableIds.includes(tid)
            );
            if (hasCommonTable) {
              assignedGroupIds.push(group.id);
              // Grubun assignedTeamId'sini de güncelle
              group.assignedTeamId = t.id;
            }
          });

          return {
            id: t.id,
            name: t.name,
            color: t.color,
            requiredStaff: t.requiredStaff || [],
            assignedGroupIds,
            leaders: t.leaders || [],
          };
        });

        // Grupları tekrar set et (assignedTeamId güncellenmiş haliyle)
        setExistingGroups([...groups]);
        setExistingTeams(teams);
      } catch {
        // Mevcut veri yoksa boş başla
        setExistingGroups([]);
        setExistingTeams([]);
      }
    } catch (err: any) {
      console.error("Veri yüklenemedi:", err);
      setError(err.message || "Veriler yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) {
      loadData();
    }
  }, [eventId, loadData]);

  const saveOrganization = useCallback(
    async (
      groups: TableGroup[],
      teams: TeamDefinition[],
      extraStaff?: ExtraStaff[]
    ): Promise<boolean> => {
      try {
        // 1. Önce takımları kaydet ve yeni ID'leri al
        const teamsResponse = await staffApi.saveEventTeams(
          eventId,
          teams.map((t) => ({
            id: t.id,
            name: t.name,
            color: t.color,
            members: t.requiredStaff.flatMap((r) =>
              r.assignedStaffIds
                .map((staffId) => {
                  const staff = allStaff.find((s) => s.id === staffId);
                  return staff
                    ? {
                        id: staff.id,
                        fullName: staff.fullName,
                        email: staff.email,
                        color: staff.color,
                        position: staff.position,
                        avatar: staff.avatar,
                      }
                    : null;
                })
                .filter(Boolean)
            ),
            tableIds: groups
              .filter((g) => g.assignedTeamId === t.id)
              .flatMap((g) => g.tableIds),
          }))
        );

        // Frontend ID -> Backend ID eşleştirme map'i oluştur
        const teamIdMap = new Map<string, string>();
        if (teamsResponse.data?.teams) {
          teamsResponse.data.teams.forEach(
            (t: { id: string; originalId?: string }) => {
              if (t.originalId) {
                teamIdMap.set(t.originalId, t.id);
              }
            }
          );
        }

        // 2. Grupları kaydet - assignedTeamId'leri yeni ID'lerle değiştir
        await staffApi.saveEventTableGroups(
          eventId,
          groups.map((g) => {
            // Frontend-generated ID'yi backend ID'ye çevir
            let resolvedTeamId = g.assignedTeamId;
            if (g.assignedTeamId && teamIdMap.has(g.assignedTeamId)) {
              resolvedTeamId = teamIdMap.get(g.assignedTeamId);
            }

            return {
              id: g.id,
              name: g.name,
              color: g.color,
              tableIds: g.tableIds,
              assignedTeamId: resolvedTeamId,
              eventId,
              groupType: "standard",
              sortOrder: 0,
            };
          })
        );

        // 3. Personel atamalarını kaydet (staffAssignments)
        // NOT: teamId UUID formatında olmalı, frontend'den gelen custom ID'ler geçersiz
        // Bu yüzden teamId'yi göndermiyoruz - takım bilgisi zaten service_teams'de
        const allAssignments: Array<{
          staffId: string;
          tableIds: string[];
          color?: string;
        }> = [];

        groups.forEach((group) => {
          if (group.staffAssignments && group.staffAssignments.length > 0) {
            group.staffAssignments.forEach((assignment) => {
              // Ekstra personelleri atla (backend'e kaydedilemez)
              if (assignment.staffId.startsWith("extra-")) {
                return;
              }

              // Aynı staffId için mevcut atamayı bul veya yeni oluştur
              const existing = allAssignments.find(
                (a) => a.staffId === assignment.staffId
              );
              if (existing) {
                // Masaları ekle
                existing.tableIds = [
                  ...new Set([...existing.tableIds, ...group.tableIds]),
                ];
              } else {
                // Yeni atama oluştur
                const staff = allStaff.find((s) => s.id === assignment.staffId);
                allAssignments.push({
                  staffId: assignment.staffId,
                  tableIds: group.tableIds,
                  color: staff?.color,
                });
              }
            });
          }
        });

        // Eğer atama varsa kaydet
        if (allAssignments.length > 0) {
          await staffApi.saveEventStaffAssignments(eventId, allAssignments);
        }

        // 4. Ekstra personelleri kaydet
        const extraStaffToSave = extraStaff || extraStaffList;
        if (extraStaffToSave.length > 0) {
          // Frontend ID'lerini temizle ve backend formatına dönüştür
          const extraStaffData = extraStaffToSave.map((es, index) => ({
            fullName: es.fullName,
            position: es.position,
            role: es.role,
            shiftStart: es.shiftStart,
            shiftEnd: es.shiftEnd,
            color: es.color,
            notes: es.notes,
            assignedGroups: es.assignedGroups,
            assignedTables: es.assignedTables,
            sortOrder: index,
          }));

          await eventExtraStaffApi.saveBulk(eventId, extraStaffData);
        } else {
          // Ekstra personel yoksa mevcut olanları temizle
          await eventExtraStaffApi.saveBulk(eventId, []);
        }

        // Events cache'ini temizle - dashboard'da güncel veri gösterilsin
        clearApiCache("events");

        return true;
      } catch (err: any) {
        console.error("❌ Kaydetme hatası:", err);
        return false;
      }
    },
    [eventId, allStaff, extraStaffList]
  );

  // ==================== SERVICE POINTS CRUD ====================

  // Yeni hizmet noktası ekle
  const addServicePoint = useCallback(
    async (data: {
      name: string;
      pointType: string;
      requiredStaffCount: number;
      allowedRoles: string[];
      color: string;
      description?: string;
    }): Promise<ServicePoint | null> => {
      try {
        // Hizmet noktalarını yan yana yerleştir (aynı Y, farklı X)
        // İlk hizmet noktası için varsayılan Y pozisyonu
        const baseY = servicePoints.length > 0 ? servicePoints[0].y : 600;
        // Her yeni hizmet noktası 4 kare (160px) sağa
        const xOffset = servicePoints.length * 160;

        const response = await servicePointsApi.create(eventId, {
          ...data,
          x: 100 + xOffset,
          y: baseY,
          shape: "square",
          sortOrder: servicePoints.length,
        });

        const newServicePoint: ServicePoint = {
          ...response.data,
          assignedStaffCount: 0,
          staffAssignments: [],
        };

        setServicePoints((prev) => [...prev, newServicePoint]);
        return newServicePoint;
      } catch (err: any) {
        console.error("❌ Hizmet noktası eklenemedi:", err);
        return null;
      }
    },
    [eventId, servicePoints]
  );

  // Hizmet noktasını güncelle
  const updateServicePoint = useCallback(
    async (id: string, data: Partial<ServicePoint>): Promise<boolean> => {
      try {
        await servicePointsApi.update(eventId, id, data);

        setServicePoints((prev) =>
          prev.map((sp) => (sp.id === id ? { ...sp, ...data } : sp))
        );
        return true;
      } catch (err: any) {
        console.error("❌ Hizmet noktası güncellenemedi:", err);
        return false;
      }
    },
    [eventId]
  );

  // Hizmet noktasını sil
  const deleteServicePoint = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await servicePointsApi.delete(eventId, id);

        setServicePoints((prev) => prev.filter((sp) => sp.id !== id));
        return true;
      } catch (err: any) {
        console.error("❌ Hizmet noktası silinemedi:", err);
        return false;
      }
    },
    [eventId]
  );

  // ==================== SERVICE POINT STAFF ASSIGNMENT ====================

  // Hizmet noktasına personel ata
  const assignStaffToServicePoint = useCallback(
    async (
      servicePointId: string,
      staffId: string,
      role: string,
      shiftStart: string,
      shiftEnd: string
    ): Promise<boolean> => {
      try {
        // Ekstra personel kontrolü - backend UUID bekliyor
        if (staffId.startsWith("extra-")) {
          console.warn(
            "⚠️ Ekstra personel hizmet noktasına atanamaz:",
            staffId
          );
          return false;
        }

        const response = await servicePointsApi.createAssignment(eventId, {
          servicePointId,
          staffId,
          role,
          shiftStart,
          shiftEnd,
        });

        // State'i güncelle
        setServicePoints((prev) =>
          prev.map((sp) => {
            if (sp.id === servicePointId) {
              const staff = allStaff.find((s) => s.id === staffId);
              const newAssignment = {
                id: response.data?.id || `temp-${Date.now()}`,
                eventId,
                servicePointId,
                staffId,
                role,
                shiftStart,
                shiftEnd,
                sortOrder: sp.staffAssignments?.length || 0,
                isActive: true,
                staff: staff,
              };
              return {
                ...sp,
                staffAssignments: [
                  ...(sp.staffAssignments || []),
                  newAssignment,
                ],
                assignedStaffCount: (sp.assignedStaffCount || 0) + 1,
              };
            }
            return sp;
          })
        );
        return true;
      } catch (err: any) {
        console.error("❌ Hizmet noktasına personel atanamadı:", err);
        return false;
      }
    },
    [eventId, allStaff]
  );

  // Hizmet noktasından personel kaldır
  const removeStaffFromServicePoint = useCallback(
    async (servicePointId: string, assignmentId: string): Promise<boolean> => {
      try {
        await servicePointsApi.deleteAssignment(eventId, assignmentId);

        // State'i güncelle
        setServicePoints((prev) =>
          prev.map((sp) => {
            if (sp.id === servicePointId) {
              return {
                ...sp,
                staffAssignments: (sp.staffAssignments || []).filter(
                  (sa) => sa.id !== assignmentId
                ),
                assignedStaffCount: Math.max(
                  (sp.assignedStaffCount || 1) - 1,
                  0
                ),
              };
            }
            return sp;
          })
        );
        return true;
      } catch (err: any) {
        console.error("❌ Hizmet noktasından personel kaldırılamadı:", err);
        return false;
      }
    },
    [eventId]
  );

  // Hizmet noktası personel atamalarını toplu kaydet
  const saveServicePointStaffAssignments = useCallback(
    async (
      servicePointId: string,
      assignments: Array<{
        id?: string;
        staffId: string;
        role: string;
        shiftId?: string;
        shiftStart: string;
        shiftEnd: string;
      }>
    ): Promise<boolean> => {
      try {
        // Mevcut service point'i bul
        const sp = servicePoints.find((s) => s.id === servicePointId);
        if (!sp) {
          console.error("❌ Hizmet noktası bulunamadı:", servicePointId);
          return false;
        }

        // Mevcut atamaları sil (yeni listede olmayanlar)
        const existingIds = new Set(
          (sp.staffAssignments || []).map((a) => a.id)
        );
        const newIds = new Set(
          assignments
            .filter(
              (a) =>
                a.id &&
                !a.id.startsWith("temp-") &&
                !a.id.startsWith("extra-") &&
                !a.id.startsWith("sp-assign-")
            )
            .map((a) => a.id)
        );

        // Silinecek atamalar
        const toDelete = (sp.staffAssignments || []).filter(
          (a) =>
            !newIds.has(a.id) &&
            !a.id.startsWith("temp-") &&
            !a.id.startsWith("extra-") &&
            !a.id.startsWith("sp-assign-")
        );

        // Sil
        for (const assignment of toDelete) {
          try {
            await servicePointsApi.deleteAssignment(eventId, assignment.id);
          } catch (err) {
            console.warn("⚠️ Atama silinemedi:", assignment.id, err);
          }
        }

        // Yeni atamaları ekle (temp- veya extra- veya sp-assign- ile başlayanlar veya existingIds'de olmayanlar)
        const toCreate = assignments.filter(
          (a) =>
            !a.id ||
            a.id.startsWith("temp-") ||
            a.id.startsWith("extra-") ||
            a.id.startsWith("sp-assign-") ||
            !existingIds.has(a.id)
        );

        // Ekstra personel olmayan yeni atamaları backend'e gönder
        const validAssignments = toCreate.filter(
          (a) => !a.staffId.startsWith("extra-")
        );

        if (validAssignments.length > 0) {
          await servicePointsApi.createBulkAssignments(
            eventId,
            validAssignments.map((a) => ({
              servicePointId,
              staffId: a.staffId,
              role: a.role,
              shiftId: a.shiftId,
              shiftStart: a.shiftStart,
              shiftEnd: a.shiftEnd,
            }))
          );
        }

        // State'i güncelle - tüm assignments'ı yeni liste ile değiştir
        setServicePoints((prev) =>
          prev.map((s) => {
            if (s.id === servicePointId) {
              // Staff bilgilerini ekle
              const enrichedAssignments = assignments.map((a) => {
                const staff = allStaff.find((st) => st.id === a.staffId);
                return {
                  id:
                    a.id ||
                    `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  eventId,
                  servicePointId,
                  staffId: a.staffId,
                  role: a.role,
                  shiftId: a.shiftId,
                  shiftStart: a.shiftStart,
                  shiftEnd: a.shiftEnd,
                  sortOrder: 0,
                  isActive: true,
                  staff: staff,
                };
              });

              return {
                ...s,
                staffAssignments: enrichedAssignments,
                assignedStaffCount: assignments.length,
              };
            }
            return s;
          })
        );

        console.log(
          "✅ Hizmet noktası personel atamaları kaydedildi:",
          servicePointId,
          assignments.length
        );
        return true;
      } catch (err: any) {
        console.error(
          "❌ Hizmet noktası personel atamaları kaydedilemedi:",
          err
        );
        return false;
      }
    },
    [eventId, servicePoints, allStaff]
  );

  return {
    event,
    tables,
    stageElements,
    allStaff,
    eventShifts,
    existingGroups,
    existingTeams,
    servicePoints,
    extraStaffList,
    loading,
    error,
    reload: loadData,
    saveOrganization,
    setExtraStaffList,
    addServicePoint,
    updateServicePoint,
    deleteServicePoint,
    assignStaffToServicePoint,
    removeStaffFromServicePoint,
    saveServicePointStaffAssignments,
  };
}
