"use client";

import { useState, useCallback } from "react";
import { staffApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast-notification";
import type { Personnel, PersonnelStats, DepartmentSummary } from "../types";

interface PersonnelFilters {
  department?: string;
  workLocation?: string;
  position?: string;
  status?: string;
}

export function usePersonnel() {
  const toast = useToast();

  // State'ler
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [personnelStats, setPersonnelStats] = useState<PersonnelStats | null>(
    null
  );
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [personnelFilters, setPersonnelFilters] = useState<PersonnelFilters>(
    {}
  );
  const [showPersonnelFilters, setShowPersonnelFilters] = useState(false);

  // Lazy loading state'leri
  const [departmentSummary, setDepartmentSummary] = useState<
    DepartmentSummary[]
  >([]);
  const [departmentSummaryLoading, setDepartmentSummaryLoading] =
    useState(false);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(
    new Set()
  );
  const [personnelByDepartmentCache, setPersonnelByDepartmentCache] = useState<
    Record<string, Personnel[]>
  >({});
  const [loadingDepartments, setLoadingDepartments] = useState<Set<string>>(
    new Set()
  );

  // Departman bazlı özet yükle (LAZY LOADING - İlk yükleme)
  const loadDepartmentSummary = useCallback(async () => {
    try {
      setDepartmentSummaryLoading(true);
      const [summaryRes, statsRes] = await Promise.all([
        staffApi.getPersonnelSummaryByDepartment(),
        staffApi.getPersonnelStats(),
      ]);
      setDepartmentSummary(summaryRes.data || []);
      setPersonnelStats(statsRes.data || null);
    } catch (error) {
      console.error("Departman özeti yüklenemedi:", error);
      setDepartmentSummary([]);
    } finally {
      setDepartmentSummaryLoading(false);
    }
  }, []);

  // Departmana göre personel yükle (LAZY LOADING - Tıklandığında)
  const loadPersonnelByDepartment = useCallback(
    async (department: string) => {
      if (personnelByDepartmentCache[department]) return;

      try {
        setLoadingDepartments((prev) => new Set(prev).add(department));
        const response = await staffApi.getPersonnelByDepartment(department);
        setPersonnelByDepartmentCache((prev) => ({
          ...prev,
          [department]: response.data || [],
        }));
      } catch (error) {
        console.error(`${department} personelleri yüklenemedi:`, error);
      } finally {
        setLoadingDepartments((prev) => {
          const next = new Set(prev);
          next.delete(department);
          return next;
        });
      }
    },
    [personnelByDepartmentCache]
  );

  // Departman kartını aç/kapat
  const toggleDepartmentCard = useCallback(
    async (department: string) => {
      const isExpanded = expandedDepartments.has(department);
      if (isExpanded) {
        setExpandedDepartments((prev) => {
          const next = new Set(prev);
          next.delete(department);
          return next;
        });
      } else {
        setExpandedDepartments((prev) => new Set(prev).add(department));
        await loadPersonnelByDepartment(department);
      }
    },
    [expandedDepartments, loadPersonnelByDepartment]
  );

  // Cache'i temizle
  const clearPersonnelCache = useCallback(() => {
    setPersonnelByDepartmentCache({});
    setExpandedDepartments(new Set());
  }, []);

  // HR Personel listesini yükle (filtreler için)
  const loadPersonnel = useCallback(async () => {
    try {
      setPersonnelLoading(true);
      const [personnelRes, statsRes] = await Promise.all([
        staffApi.getPersonnel(personnelFilters),
        staffApi.getPersonnelStats(),
      ]);
      setPersonnel(personnelRes.data || []);
      setPersonnelStats(statsRes.data || null);
    } catch (error) {
      console.error("HR Personel listesi yüklenemedi:", error);
      setPersonnel([]);
    } finally {
      setPersonnelLoading(false);
    }
  }, [personnelFilters]);

  // Filtrelenmiş personel listesi
  const getFilteredPersonnel = useCallback(() => {
    return personnel.filter((p) => {
      if (personnelSearch) {
        const q = personnelSearch.toLowerCase();
        const match =
          p.fullName.toLowerCase().includes(q) ||
          p.sicilNo.toLowerCase().includes(q) ||
          p.position?.toLowerCase().includes(q) ||
          p.department?.toLowerCase().includes(q) ||
          p.workLocation?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [personnel, personnelSearch]);

  // Pozisyona göre gruplandırılmış personel
  const getPersonnelByPosition = useCallback(() => {
    const filtered = getFilteredPersonnel();
    return filtered.reduce((acc, p) => {
      const pos = p.position || "Diğer";
      if (!acc[pos]) acc[pos] = [];
      acc[pos].push(p);
      return acc;
    }, {} as Record<string, Personnel[]>);
  }, [getFilteredPersonnel]);

  // Unique değerler (filtreler için)
  const getUniqueValues = useCallback(() => {
    return {
      departments: [
        ...new Set(personnel.map((p) => p.department).filter(Boolean)),
      ] as string[],
      locations: [
        ...new Set(personnel.map((p) => p.workLocation).filter(Boolean)),
      ] as string[],
      positions: [
        ...new Set(personnel.map((p) => p.position).filter(Boolean)),
      ] as string[],
    };
  }, [personnel]);

  // Personnel CRUD handlers
  const handleSavePersonnel = useCallback(
    async (
      data: Partial<Personnel>,
      editingPersonnel: Personnel | null,
      onSuccess: () => void,
      avatarFile?: File | null
    ) => {
      try {
        let savedPersonnel: Personnel;

        if (editingPersonnel) {
          const res = await staffApi.updatePersonnel(editingPersonnel.id, data);
          savedPersonnel = res.data;
          toast.success("Personel güncellendi");

          // Avatar dosyası varsa yükle
          if (avatarFile) {
            try {
              await staffApi.uploadPersonnelAvatar(
                editingPersonnel.id,
                avatarFile
              );
              toast.success("Avatar yüklendi");
            } catch (avatarError: any) {
              toast.error(
                avatarError.response?.data?.message || "Avatar yüklenemedi"
              );
            }
          }
        } else {
          // Yeni personel oluştur
          const res = await staffApi.createPersonnel(data as any);
          savedPersonnel = res.data;
          toast.success("Personel oluşturuldu");

          // Yeni personel için avatar yükle
          if (avatarFile && savedPersonnel.id) {
            try {
              await staffApi.uploadPersonnelAvatar(
                savedPersonnel.id,
                avatarFile
              );
              toast.success("Avatar yüklendi");
            } catch (avatarError: any) {
              toast.error(
                avatarError.response?.data?.message || "Avatar yüklenemedi"
              );
            }
          }
        }

        clearPersonnelCache();
        loadDepartmentSummary();
        onSuccess();
      } catch (error: any) {
        toast.error(error.response?.data?.message || "İşlem başarısız");
      }
    },
    [toast, clearPersonnelCache, loadDepartmentSummary]
  );

  const handleDeletePersonnel = useCallback(
    async (personnelToDelete: Personnel) => {
      try {
        await staffApi.deletePersonnel(personnelToDelete.id);
        toast.success("Personel silindi");
        clearPersonnelCache();
        loadDepartmentSummary();
        return true;
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Silme başarısız");
        return false;
      }
    },
    [toast, clearPersonnelCache, loadDepartmentSummary]
  );

  const handleImportCSV = useCallback(
    async (data: Array<Record<string, string>>) => {
      try {
        const res = await staffApi.importPersonnelCSV(data);
        toast.success(`${res.data.imported} personel içe aktarıldı`);
        clearPersonnelCache();
        loadDepartmentSummary();
        return true;
      } catch (error: any) {
        toast.error(error.response?.data?.message || "İçe aktarma başarısız");
        return false;
      }
    },
    [toast, clearPersonnelCache, loadDepartmentSummary]
  );

  const handleExportCSV = useCallback(() => {
    const filtered = getFilteredPersonnel();
    const headers = [
      "Sicil No",
      "Ad Soyad",
      "Pozisyon",
      "Bölüm",
      "Görev Yeri",
      "Telefon",
      "E-posta",
      "Durum",
    ];
    const rows = filtered.map((p) => [
      p.sicilNo,
      p.fullName,
      p.position || "",
      p.department || "",
      p.workLocation || "",
      p.phone || "",
      p.email || "",
      p.status === "active"
        ? "Aktif"
        : p.status === "inactive"
        ? "Pasif"
        : "Ayrıldı",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personel_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV dosyası indirildi");
  }, [getFilteredPersonnel, toast]);

  // Filtre aktif mi kontrolü
  const hasActiveFilters = Boolean(
    personnelFilters.department ||
      personnelFilters.workLocation ||
      personnelFilters.position ||
      personnelFilters.status ||
      personnelSearch
  );

  return {
    // State'ler
    personnel,
    personnelStats,
    personnelLoading,
    personnelSearch,
    setPersonnelSearch,
    personnelFilters,
    setPersonnelFilters,
    showPersonnelFilters,
    setShowPersonnelFilters,

    // Lazy loading
    departmentSummary,
    departmentSummaryLoading,
    expandedDepartments,
    personnelByDepartmentCache,
    loadingDepartments,

    // Fonksiyonlar
    loadDepartmentSummary,
    loadPersonnelByDepartment,
    toggleDepartmentCard,
    clearPersonnelCache,
    loadPersonnel,
    getFilteredPersonnel,
    getPersonnelByPosition,
    getUniqueValues,
    hasActiveFilters,

    // CRUD
    handleSavePersonnel,
    handleDeletePersonnel,
    handleImportCSV,
    handleExportCSV,
  };
}
