"use client";

import { useState, useCallback, useEffect } from "react";
import {
  staffApi,
  eventsApi,
  positionsApi,
  departmentsApi,
  workLocationsApi,
} from "@/lib/api";
import type {
  Staff,
  Team,
  Event,
  WorkShift,
  Role,
  Position,
  Department,
  WorkLocation,
} from "../types";

export function useStaffData() {
  // Ana state'ler
  const [staff, setStaff] = useState<Staff[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Loading state'leri
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Lookup listeler
  const [positionsList, setPositionsList] = useState<Position[]>([]);
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);
  const [workLocationsList, setWorkLocationsList] = useState<WorkLocation[]>(
    []
  );

  // Rolleri API'den yükle
  const loadRoles = useCallback(async () => {
    try {
      const response = await staffApi.getRoles();
      setRoles(response.data || []);
    } catch (error: any) {
      console.error("Roller yüklenemedi:", error?.response?.data || error);
      setRoles([]);
    }
  }, []);

  // Positions (Unvanlar) API'den yükle
  const loadPositions = useCallback(async () => {
    try {
      const response = await positionsApi.getAll();
      setPositionsList(response.data || []);
    } catch (error: any) {
      console.error("Unvanlar yüklenemedi:", error?.response?.data || error);
      setPositionsList([]);
    }
  }, []);

  // Departments (Bölümler) API'den yükle
  const loadDepartments = useCallback(async () => {
    try {
      const response = await departmentsApi.getAll();
      setDepartmentsList(response.data || []);
    } catch (error: any) {
      console.error("Bölümler yüklenemedi:", error?.response?.data || error);
      setDepartmentsList([]);
    }
  }, []);

  // Work Locations (Görev Yerleri) API'den yükle
  const loadWorkLocations = useCallback(async () => {
    try {
      const response = await workLocationsApi.getAll();
      setWorkLocationsList(response.data || []);
    } catch (error: any) {
      console.error(
        "Görev yerleri yüklenemedi:",
        error?.response?.data || error
      );
      setWorkLocationsList([]);
    }
  }, []);

  // Personel listesini yükle
  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      const response = await staffApi.getAll();
      setStaff(response.data || []);
    } catch (error) {
      console.error("Personel listesi yüklenemedi:", error);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Etkinlikleri yükle
  const loadEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      const response = await eventsApi.getAll();
      // API response formatı: { items: [], meta: {} } veya doğrudan array
      const data = response.data;
      const eventsArray = Array.isArray(data) ? data : data?.items || [];
      const sorted = eventsArray.sort((a: Event, b: Event) => {
        const dateA = a.eventDate || a.date;
        const dateB = b.eventDate || b.date;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      setEvents(sorted);
    } catch (error) {
      console.error("Etkinlikler yüklenemedi:", error);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // Çalışma saatlerini yükle
  const loadShifts = useCallback(async () => {
    try {
      const response = await staffApi.getShifts();
      setShifts(response.data || []);
    } catch (error) {
      console.error("Çalışma saatleri yüklenemedi:", error);
      setShifts([]);
    }
  }, []);

  // Ekipleri yükle
  const loadTeams = useCallback(async () => {
    try {
      setTeamsLoading(true);
      const response = await staffApi.getTeams();
      setTeams(response.data || []);
    } catch (error) {
      console.error("Ekipler yüklenemedi:", error);
      setTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  // Tüm verileri yükle - sıralı olarak rate limit'e takılmamak için
  const loadAllData = useCallback(async () => {
    // Önce kritik verileri yükle
    await loadStaff();
    await loadTeams();

    // Sonra diğerlerini paralel yükle (daha az kritik)
    await Promise.all([
      loadEvents(),
      loadRoles(),
      loadShifts(),
      loadPositions(),
      loadDepartments(),
      loadWorkLocations(),
    ]);
  }, [
    loadStaff,
    loadTeams,
    loadEvents,
    loadRoles,
    loadShifts,
    loadPositions,
    loadDepartments,
    loadWorkLocations,
  ]);

  // Helper: Rol bilgisini key'e göre bul
  const getRoleByKey = useCallback(
    (key: string) => roles.find((r) => r.key === key),
    [roles]
  );
  const getRoleLabel = useCallback(
    (key: string) => getRoleByKey(key)?.label || key,
    [getRoleByKey]
  );
  const getRoleColor = useCallback(
    (key: string) => getRoleByKey(key)?.color || "#3b82f6",
    [getRoleByKey]
  );
  const getRoleBadgeColor = useCallback(
    (key: string) =>
      getRoleByKey(key)?.badgeColor ||
      "bg-slate-500/20 text-slate-400 border-slate-500/30",
    [getRoleByKey]
  );

  return {
    // State'ler
    staff,
    setStaff,
    teams,
    setTeams,
    events,
    shifts,
    setShifts,
    roles,
    setRoles,
    loading,
    eventsLoading,
    teamsLoading,
    positionsList,
    departmentsList,
    workLocationsList,

    // Yükleme fonksiyonları
    loadStaff,
    loadTeams,
    loadEvents,
    loadShifts,
    loadRoles,
    loadPositions,
    loadDepartments,
    loadWorkLocations,
    loadAllData,

    // Helper fonksiyonlar
    getRoleByKey,
    getRoleLabel,
    getRoleColor,
    getRoleBadgeColor,
  };
}
