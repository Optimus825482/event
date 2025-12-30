import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
export const API_BASE = API_URL.replace("/api", ""); // http://localhost:4000

// Simple in-memory cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 60 saniye cache süresi (OPTİMİZE: 30s -> 60s)

// Token refresh state
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Cache helper functions
const getCached = <T>(key: string): T | null => {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  apiCache.delete(key);
  return null;
};

const setCache = (key: string, data: any) => {
  apiCache.set(key, { data, timestamp: Date.now() });
};

export const clearApiCache = (pattern?: string) => {
  if (pattern) {
    for (const key of apiCache.keys()) {
      if (key.includes(pattern)) apiCache.delete(key);
    }
  } else {
    apiCache.clear();
  }
};

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Token interceptor
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    // Zustand persist storage'dan token al
    const authStorage = localStorage.getItem("auth-storage");
    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        const token = parsed?.state?.token;

        // DEBUG: Token kontrolü
        console.log(
          "[API Interceptor] Token exists:",
          !!token,
          "Token length:",
          token?.length || 0
        );

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          console.warn(
            "[API Interceptor] Token is null/undefined in auth-storage"
          );
        }
      } catch (e) {
        console.error("[API Interceptor] JSON parse error:", e);
      }
    } else {
      console.warn("[API Interceptor] No auth-storage in localStorage");
    }
  }
  return config;
});

// Response interceptor - 401 hatalarında auto token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Network hatası veya backend kapalıysa sessizce devam et
    if (!error.response) {
      return Promise.reject(error);
    }

    // 401 hatası ve henüz retry yapılmadıysa token refresh dene
    if (error.response.status === 401 && !originalRequest._retry) {
      // Login endpoint'i için refresh deneme
      if (originalRequest.url?.includes("/auth/login")) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Zaten refresh yapılıyorsa kuyruğa ekle
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token'ı localStorage'dan al
        const authStorage = localStorage.getItem("auth-storage");
        if (!authStorage) {
          throw new Error("No auth storage");
        }

        const parsed = JSON.parse(authStorage);
        const refreshToken = parsed?.state?.refreshToken;

        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        // Refresh token ile yeni access token al
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // Yeni token'ları localStorage'a kaydet
        parsed.state.token = accessToken;
        if (newRefreshToken) {
          parsed.state.refreshToken = newRefreshToken;
        }
        localStorage.setItem("auth-storage", JSON.stringify(parsed));

        console.log("[API] Token refreshed successfully");

        // Bekleyen istekleri işle
        processQueue(null, accessToken);

        // Orijinal isteği yeni token ile tekrarla
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("[API] Token refresh failed:", refreshError);
        processQueue(refreshError as Error, null);

        // Refresh başarısız - sadece state'i temizle
        // Yönlendirme layout'larda yapılacak
        const authStorage = localStorage.getItem("auth-storage");
        if (authStorage) {
          try {
            const parsed = JSON.parse(authStorage);
            parsed.state.token = null;
            parsed.state.refreshToken = null;
            parsed.state.isAuthenticated = false;
            parsed.state.user = null;
            localStorage.setItem("auth-storage", JSON.stringify(parsed));
            console.log("[API] Auth state cleared - refresh failed");
          } catch (e) {
            // JSON parse hatası - storage'ı tamamen temizle
            localStorage.removeItem("auth-storage");
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    api.post("/auth/login", { username, password }),
  register: (data: {
    username: string;
    email?: string;
    password: string;
    fullName: string;
  }) => api.post("/auth/register", data),
  me: () => api.get("/auth/me"),
  updateProfile: (data: {
    fullName?: string;
    email?: string;
    phone?: string;
  }) => api.patch("/auth/profile", data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post("/auth/change-password", { currentPassword, newPassword }),
};

// Events API - Cache destekli
export const eventsApi = {
  getAll: async (useCache = true) => {
    const cacheKey = "events:all";
    if (useCache) {
      const cached = getCached<any>(cacheKey);
      if (cached) return { data: cached };
    }
    const response = await api.get("/events?all=true");
    setCache(cacheKey, response.data);
    return response;
  },
  getOne: (id: string) => api.get(`/events/${id}`),
  create: async (data: any) => {
    clearApiCache("events"); // Cache'i temizle
    return api.post("/events", data);
  },
  update: async (id: string, data: any) => {
    clearApiCache("events");
    return api.put(`/events/${id}`, data);
  },
  delete: async (id: string) => {
    clearApiCache("events");
    return api.delete(`/events/${id}`);
  },
  updateLayout: async (id: string, data: { venueLayout: any }) => {
    clearApiCache("events");
    return api.patch(`/events/${id}/layout`, data);
  },
};

// Tables API
export const tablesApi = {
  getTypes: () => api.get("/tables/types"),
  createType: (data: any) => api.post("/tables/types", data),
  updateType: (id: string, data: any) => api.put(`/tables/types/${id}`, data),
  deleteType: (id: string) => api.delete(`/tables/types/${id}`),
  seedDefaults: () => api.post("/tables/seed"),
};

// Customers API
export const customersApi = {
  getAll: () => api.get("/customers"),
  getAllWithStats: (search?: string, page = 1, limit = 50) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    params.append("page", String(page));
    params.append("limit", String(limit));
    return api.get(`/customers/list/with-stats?${params.toString()}`);
  },
  // Tüm misafirler (customers + reservations'dan benzersiz misafirler)
  getAllGuests: (search?: string, page = 1, limit = 50) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    params.append("page", String(page));
    params.append("limit", String(limit));
    return api.get(`/customers/list/all-guests?${params.toString()}`);
  },
  getOne: (id: string) => api.get(`/customers/${id}`),
  getWithNotes: (id: string) => api.get(`/customers/${id}/with-notes`),
  search: (query: string) => api.get(`/customers/search?q=${query}`),
  searchAutocomplete: (query: string, limit?: number) =>
    api.get(
      `/customers/search/autocomplete?q=${query}${
        limit ? `&limit=${limit}` : ""
      }`
    ),
  create: (data: any) => api.post("/customers", data),
  update: (id: string, data: any) => api.put(`/customers/${id}`, data),
  findOrCreate: (data: { fullName: string; phone?: string; email?: string }) =>
    api.post("/customers/find-or-create", data),
  // Not işlemleri
  addNote: (
    customerId: string,
    data: {
      content: string;
      noteType?: string;
      eventId?: string;
      reservationId?: string;
    }
  ) => api.post(`/customers/${customerId}/notes`, data),
  getNotesForEvent: (customerId: string, eventId: string) =>
    api.get(`/customers/${customerId}/notes/event/${eventId}`),
  updateNote: (noteId: string, content: string) =>
    api.put(`/customers/notes/${noteId}`, { content }),
  deleteNote: (noteId: string) => api.delete(`/customers/notes/${noteId}`),
  // Blacklist toggle
  toggleBlacklist: (id: string) => api.post(`/customers/${id}/blacklist`),
  // Delete customer
  delete: (id: string) => api.delete(`/customers/${id}`),
};

// Reservations API
export const reservationsApi = {
  // CRUD Operations
  getAll: (filters?: {
    eventId?: string;
    customerId?: string;
    status?: string;
    searchQuery?: string;
    tableId?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.eventId) params.append("eventId", filters.eventId);
    if (filters?.customerId) params.append("customerId", filters.customerId);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.searchQuery) params.append("searchQuery", filters.searchQuery);
    if (filters?.tableId) params.append("tableId", filters.tableId);
    return api.get(`/reservations?${params.toString()}`);
  },
  getOne: (id: string) => api.get(`/reservations/${id}`),
  create: (data: {
    eventId: string;
    tableId: string;
    customerId?: string;
    guestCount: number;
    specialRequests?: string;
    totalAmount?: number;
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string;
  }) => api.post("/reservations", data),
  update: (
    id: string,
    data: {
      tableId?: string;
      guestCount?: number;
      status?: string;
      specialRequests?: string;
      totalAmount?: number;
      isPaid?: boolean;
    }
  ) => api.put(`/reservations/${id}`, data),
  delete: (id: string) => api.delete(`/reservations/${id}`),
  cancel: (id: string) => api.post(`/reservations/${id}/cancel`),

  // Search & Filter (Requirements 7.1, 7.2, 7.3, 7.4)
  search: (query: string, eventId?: string) => {
    const params = new URLSearchParams({ q: query });
    if (eventId) params.append("eventId", eventId);
    return api.get(`/reservations/search?${params.toString()}`);
  },
  filter: (filters: {
    status?: string;
    eventId?: string;
    tableId?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.eventId) params.append("eventId", filters.eventId);
    if (filters.tableId) params.append("tableId", filters.tableId);
    return api.get(`/reservations/filter?${params.toString()}`);
  },

  // QR Code Operations (Requirements 3.1, 3.2, 3.3, 3.4)
  generateQRCode: (id: string) => api.get(`/reservations/${id}/qrcode`),
  getByQRCode: (qrCodeHash: string) =>
    api.get(`/reservations/qr/${qrCodeHash}`),

  // Check-in Operations (Requirements 4.1, 4.2, 4.3, 4.4)
  checkIn: (qrCodeHash: string) =>
    api.post(`/reservations/check-in/${qrCodeHash}`),

  // Table Operations
  getByTable: (eventId: string, tableId: string) =>
    api.get(`/reservations/event/${eventId}/table/${tableId}`),
  isTableAvailable: (eventId: string, tableId: string) =>
    api.get(`/reservations/event/${eventId}/table/${tableId}/available`),

  // Event Stats (Requirement 5.1)
  getEventStats: (eventId: string) =>
    api.get(`/reservations/event/${eventId}/stats`),

  // CRM Integration (Requirements 6.1, 6.2)
  getCustomerHistory: (customerId: string) =>
    api.get(`/reservations/customer/${customerId}/history`),
  checkBlacklistStatus: (customerId: string) =>
    api.get(`/reservations/customer/${customerId}/blacklist-status`),
  getCustomerInfoForReservation: (customerId: string) =>
    api.get(`/reservations/customer/${customerId}/info`),
};

// Venues API - Cache destekli
export const venuesApi = {
  getAll: async (useCache = true) => {
    const cacheKey = "venues:all";
    if (useCache) {
      const cached = getCached<any>(cacheKey);
      if (cached) return { data: cached };
    }
    const response = await api.get("/venues");
    setCache(cacheKey, response.data);
    return response;
  },
  getMarketplace: () => api.get("/venues/marketplace"),
  getOne: (id: string) => api.get(`/venues/${id}`),
  create: async (data: any) => {
    clearApiCache("venues");
    return api.post("/venues", data);
  },
  update: async (id: string, data: any) => {
    clearApiCache("venues");
    return api.put(`/venues/${id}`, data);
  },
  delete: async (id: string) => {
    clearApiCache("venues");
    return api.delete(`/venues/${id}`);
  },
};

// Staff pozisyon tipleri
export type StaffPosition =
  | "supervizor"
  | "sef"
  | "garson"
  | "komi"
  | "debarasor";

// Staff API - Cache destekli
export const staffApi = {
  // Personel CRUD - Cache destekli
  getAll: async (activeOnly?: boolean, useCache = true) => {
    const cacheKey = `staff:all:${activeOnly || "all"}`;
    if (useCache) {
      const cached = getCached<any>(cacheKey);
      if (cached) return { data: cached };
    }
    const response = await api.get(`/staff${activeOnly ? "?active=true" : ""}`);
    setCache(cacheKey, response.data);
    return response;
  },
  getOne: (id: string) => api.get(`/staff/${id}`),
  create: async (data: {
    email: string;
    fullName: string;
    password: string;
    phone?: string;
    color?: string;
    position?: StaffPosition;
    avatar?: string;
  }) => {
    clearApiCache("staff");
    return api.post("/staff", data);
  },
  update: async (
    id: string,
    data: {
      fullName?: string;
      phone?: string;
      color?: string;
      position?: StaffPosition;
      avatar?: string;
      isActive?: boolean;
    }
  ) => {
    clearApiCache("staff");
    return api.put(`/staff/${id}`, data);
  },
  delete: async (id: string) => {
    clearApiCache("staff");
    return api.delete(`/staff/${id}`);
  },

  // Ekipleri getir - Cache destekli
  getTeams: async (useCache = true) => {
    const cacheKey = "staff:teams";
    if (useCache) {
      const cached = getCached<any>(cacheKey);
      if (cached) return { data: cached };
    }
    const response = await api.get("/staff/teams");
    setCache(cacheKey, response.data);
    return response;
  },

  // Alias for getAllTeams (React Query hooks compatibility)
  getAllTeams: async (useCache = true) => {
    const cacheKey = "staff:teams";
    if (useCache) {
      const cached = getCached<any>(cacheKey);
      if (cached) return { data: cached };
    }
    const response = await api.get("/staff/teams");
    setCache(cacheKey, response.data);
    return response;
  },

  // Etkinlik için personel getir
  getForEvent: (eventId: string) => api.get(`/staff/event/${eventId}`),

  // Ekibe üye ekle (alias)
  addTeamMember: async (teamId: string, staffId: string) => {
    clearApiCache("staff:teams");
    return api.post(`/staff/teams/${teamId}/members`, { memberId: staffId });
  },

  // Ekipten üye çıkar (alias)
  removeTeamMember: async (teamId: string, staffId: string) => {
    clearApiCache("staff:teams");
    return api.delete(`/staff/teams/${teamId}/members/${staffId}`);
  },

  // Etkinliğe personel ata (alias)
  assignToEvent: (eventId: string, assignments: any[]) =>
    api.post(`/staff/events/${eventId}/assignments/save`, { assignments }),

  // Atama işlemleri
  getEventAssignments: (eventId: string) => api.get(`/staff/event/${eventId}`),
  getEventSummary: (eventId: string) =>
    api.get(`/staff/event/${eventId}/summary`),
  assignTables: (data: {
    eventId: string;
    staffId: string;
    tableIds: string[];
    color?: string;
  }) => api.post("/staff/assign", data),
  bulkAssign: (data: {
    eventId: string;
    assignments: Array<{ staffId: string; tableIds: string[] }>;
  }) => api.post("/staff/assign/bulk", data),
  removeAssignment: (eventId: string, staffId: string) =>
    api.delete(`/staff/assign/${eventId}/${staffId}`),

  // Otomatik atama
  autoAssign: (
    eventId: string,
    data: { staffIds: string[]; strategy?: "balanced" | "zone" | "random" }
  ) => api.post(`/staff/event/${eventId}/auto-assign`, data),

  // Atamaları kaydet
  saveAssignments: (
    eventId: string,
    assignments: Array<{ staffId: string; tableIds: string[]; color?: string }>
  ) => api.post(`/staff/event/${eventId}/save`, { assignments }),

  // ==================== TEAM API ====================

  // Etkinlik için tüm ekipleri getir
  getEventTeams: (eventId: string) => api.get(`/staff/event/${eventId}/teams`),

  // Yeni ekip oluştur
  createTeam: (data: {
    name: string;
    color?: string;
    memberIds?: string[];
    leaderId?: string;
  }) => api.post("/staff/teams", data),

  // Ekip güncelle
  updateTeam: async (
    teamId: string,
    data: {
      name?: string;
      color?: string;
      memberIds?: string[];
      leaderId?: string;
    }
  ) => {
    clearApiCache("staff:teams");
    return api.put(`/staff/teams/${teamId}`, data);
  },

  // Ekip liderini ata/değiştir - HIZLI ENDPOINT
  setTeamLeader: async (teamId: string, leaderId: string | null) => {
    clearApiCache("staff:teams");
    return api.put(`/staff/teams/${teamId}/leader`, { leaderId });
  },

  // Ekip sil
  deleteTeam: async (teamId: string) => {
    clearApiCache("staff:teams");
    return api.delete(`/staff/teams/${teamId}`);
  },

  // Toplu ekip sil
  bulkDeleteTeams: async (teamIds: string[]) => {
    clearApiCache("staff:teams");
    return api.delete(`/staff/teams/bulk/delete`, { data: { teamIds } });
  },

  // Ekibe üye ekle
  addMemberToTeam: async (teamId: string, data: { memberId: string }) => {
    clearApiCache("staff:teams");
    return api.post(`/staff/teams/${teamId}/members`, data);
  },

  // Ekibe toplu üye ekle
  addMembersToTeamBulk: async (teamId: string, memberIds: string[]) => {
    clearApiCache("staff:teams");
    return api.post(`/staff/teams/${teamId}/members/bulk`, { memberIds });
  },

  // Ekipten üye çıkar
  removeMemberFromTeam: async (teamId: string, memberId: string) => {
    clearApiCache("staff:teams");
    return api.delete(`/staff/teams/${teamId}/members/${memberId}`);
  },

  // Ekibe masa ata
  assignTablesToTeam: (teamId: string, tableIds: string[]) =>
    api.post(`/staff/teams/${teamId}/tables`, { tableIds }),

  // Tüm ekipleri toplu kaydet
  saveEventTeams: (
    eventId: string,
    teams: Array<{
      id?: string;
      name: string;
      color: string;
      members: any[];
      leaderId?: string;
      tableIds: string[];
    }>
  ) => api.post(`/staff/event/${eventId}/teams/save`, { teams }),

  // ==================== TABLE GROUP API ====================

  // Etkinlik için tüm masa gruplarını getir
  getEventTableGroups: (eventId: string) =>
    api.get(`/staff/event/${eventId}/table-groups`),

  // Yeni masa grubu oluştur
  createTableGroup: (data: {
    eventId: string;
    name: string;
    color?: string;
    tableIds: string[];
    groupType?: string;
    notes?: string;
  }) => api.post("/staff/table-groups", data),

  // Masa grubu güncelle
  updateTableGroup: (
    groupId: string,
    data: {
      name?: string;
      color?: string;
      tableIds?: string[];
      groupType?: string;
      notes?: string;
      assignedTeamId?: string;
      assignedSupervisorId?: string;
      sortOrder?: number;
    }
  ) => api.put(`/staff/table-groups/${groupId}`, data),

  // Masa grubu sil
  deleteTableGroup: (groupId: string) =>
    api.delete(`/staff/table-groups/${groupId}`),

  // Gruba masa ekle
  addTablesToGroup: (groupId: string, tableIds: string[]) =>
    api.post(`/staff/table-groups/${groupId}/tables`, { tableIds }),

  // Gruptan masa çıkar
  removeTablesFromGroup: (groupId: string, tableIds: string[]) =>
    api.delete(`/staff/table-groups/${groupId}/tables`, { data: { tableIds } }),

  // Gruba süpervizör ata
  assignSupervisorToGroup: (groupId: string, supervisorId: string) =>
    api.post(`/staff/table-groups/${groupId}/supervisor`, { supervisorId }),

  // Gruptan süpervizör kaldır
  removeSupervisorFromGroup: (groupId: string) =>
    api.delete(`/staff/table-groups/${groupId}/supervisor`),

  // Gruba ekip ata
  assignTeamToGroup: (groupId: string, teamId: string) =>
    api.post(`/staff/table-groups/${groupId}/team`, { teamId }),

  // Tüm masa gruplarını toplu kaydet
  saveEventTableGroups: (
    eventId: string,
    groups: Array<{
      id?: string;
      name: string;
      color: string;
      tableIds: string[];
      groupType?: string;
      assignedTeamId?: string;
      assignedSupervisorId?: string;
      notes?: string;
      sortOrder?: number;
    }>
  ) => api.post(`/staff/event/${eventId}/table-groups/save`, { groups }),

  // Süpervizörleri getir
  getSupervisors: () => api.get("/staff/supervisors"),

  // Etkinlik organizasyon özeti
  getEventOrganizationSummary: (eventId: string) =>
    api.get(`/staff/event/${eventId}/organization-summary`),

  // ==================== STAFF ROLES API ====================

  // Tüm rolleri getir
  getRoles: () => api.get("/staff/roles"),

  // Yeni rol oluştur
  createRole: (data: {
    key: string;
    label: string;
    color: string;
    badgeColor?: string;
    bgColor?: string;
  }) => api.post("/staff/roles", data),

  // Rol güncelle
  updateRole: (
    id: string,
    data: {
      label?: string;
      color?: string;
      badgeColor?: string;
      bgColor?: string;
      sortOrder?: number;
    }
  ) => api.put(`/staff/roles/${id}`, data),

  // Rol sil (soft delete)
  deleteRole: (id: string) => api.delete(`/staff/roles/${id}`),

  // Rol kalıcı sil
  hardDeleteRole: (id: string) => api.delete(`/staff/roles/${id}/hard`),

  // ==================== WORK SHIFTS (ÇALIŞMA SAATLERİ) API ====================

  // Tüm çalışma saatlerini getir (global + opsiyonel eventId)
  getShifts: (eventId?: string) =>
    api.get(`/staff/shifts${eventId ? `?eventId=${eventId}` : ""}`),

  // Etkinliğe özel vardiyaları getir
  getEventShifts: (eventId: string) =>
    api.get(`/staff/events/${eventId}/shifts`),

  // Yeni çalışma saati oluştur (global veya etkinliğe özel)
  createShift: (data: {
    name: string;
    startTime: string;
    endTime: string;
    color?: string;
    eventId?: string;
  }) => api.post("/staff/shifts", data),

  // Etkinliğe özel toplu vardiya oluştur
  createBulkShifts: (
    eventId: string,
    shifts: Array<{
      name: string;
      startTime: string;
      endTime: string;
      color?: string;
    }>
  ) => api.post(`/staff/events/${eventId}/shifts/bulk`, { shifts }),

  // Çalışma saati güncelle
  updateShift: (
    id: string,
    data: {
      name?: string;
      startTime?: string;
      endTime?: string;
      color?: string;
      sortOrder?: number;
    }
  ) => api.put(`/staff/shifts/${id}`, data),

  // Çalışma saati sil
  deleteShift: (id: string) => api.delete(`/staff/shifts/${id}`),

  // ==================== TEAMS (EKİPLER) API - YENİ ====================

  // Yeni ekip oluştur
  createNewTeam: (data: {
    name: string;
    color?: string;
    memberIds?: string[];
    leaderId?: string;
  }) => api.post("/staff/teams", data),

  // Ekip güncelle
  updateNewTeam: (
    id: string,
    data: {
      name?: string;
      color?: string;
      memberIds?: string[];
      leaderId?: string;
      sortOrder?: number;
    }
  ) => api.put(`/staff/teams/${id}`, data),

  // Ekip sil
  deleteNewTeam: (id: string) => api.delete(`/staff/teams/${id}`),

  // Ekibe üye ekle
  addMemberToNewTeam: (teamId: string, memberId: string) =>
    api.post(`/staff/teams/${teamId}/members`, { memberId }),

  // Ekipten üye çıkar
  removeMemberFromNewTeam: (teamId: string, memberId: string) =>
    api.delete(`/staff/teams/${teamId}/members/${memberId}`),

  // ==================== EVENT STAFF ASSIGNMENT API ====================

  // Personelin tüm etkinliklerdeki atamalarını getir
  getStaffEventAssignments: (staffId: string) =>
    api.get(`/staff/${staffId}/event-assignments`),

  // Etkinlik için tüm personel atamalarını getir
  getEventStaffAssignments: (eventId: string) =>
    api.get(`/staff/events/${eventId}/assignments`),

  // Personel ata (masa/masalara)
  assignStaffToTables: (
    eventId: string,
    data: {
      staffId: string;
      tableIds: string[];
      shiftId?: string;
      teamId?: string;
      color?: string;
      assignmentType?: "table" | "special_task";
      specialTaskLocation?: string;
      specialTaskStartTime?: string;
      specialTaskEndTime?: string;
    }
  ) => api.post(`/staff/events/${eventId}/assignments`, data),

  // Personel atamasını güncelle
  updateStaffAssignment: (
    assignmentId: string,
    data: {
      tableIds?: string[];
      shiftId?: string;
      teamId?: string;
      color?: string;
      notes?: string;
    }
  ) => api.put(`/staff/assignments/${assignmentId}`, data),

  // Personel atamasını kaldır
  removeStaffAssignment: (assignmentId: string) =>
    api.delete(`/staff/assignments/${assignmentId}`),

  // Tüm etkinlik atamalarını kaydet (toplu)
  saveEventStaffAssignments: (
    eventId: string,
    assignments: Array<{
      staffId: string;
      tableIds: string[];
      shiftId?: string;
      teamId?: string;
      color?: string;
    }>
  ) => api.post(`/staff/events/${eventId}/assignments/save`, { assignments }),

  // ==================== ORGANIZATION TEMPLATE API ====================

  // Tüm şablonları getir
  getOrganizationTemplates: () => api.get("/staff/organization-templates"),

  // Tek şablon getir
  getOrganizationTemplate: (id: string) =>
    api.get(`/staff/organization-templates/${id}`),

  // Şablon oluştur (mevcut etkinlik organizasyonundan)
  createOrganizationTemplate: (data: {
    name: string;
    description?: string;
    eventId: string;
  }) => api.post("/staff/organization-templates", data),

  // Şablonu etkinliğe uygula
  applyOrganizationTemplate: (templateId: string, eventId: string) =>
    api.post(`/staff/organization-templates/${templateId}/apply`, { eventId }),

  // Şablon sil
  deleteOrganizationTemplate: (id: string) =>
    api.delete(`/staff/organization-templates/${id}`),

  // Varsayılan şablon yap
  setDefaultTemplate: (id: string) =>
    api.post(`/staff/organization-templates/${id}/set-default`),

  // ==================== PERSONNEL (HR STAFF) API ====================

  // Tüm personeli listele (yeni Staff tablosundan)
  getPersonnel: async (
    filters?: {
      department?: string;
      workLocation?: string;
      position?: string;
      isActive?: boolean;
      status?: string;
    },
    useCache = true
  ) => {
    const params = new URLSearchParams();
    if (filters?.department) params.append("department", filters.department);
    if (filters?.workLocation)
      params.append("workLocation", filters.workLocation);
    if (filters?.position) params.append("position", filters.position);
    if (filters?.isActive !== undefined)
      params.append("isActive", String(filters.isActive));
    if (filters?.status) params.append("status", filters.status);

    const cacheKey = `personnel:${params.toString()}`;
    if (useCache) {
      const cached = getCached<any>(cacheKey);
      if (cached) return { data: cached };
    }
    const response = await api.get(`/staff/personnel?${params.toString()}`);
    setCache(cacheKey, response.data);
    return response;
  },

  // Personel istatistikleri
  getPersonnelStats: () => api.get("/staff/personnel/stats"),

  // ==================== LAZY LOADING API ====================

  // Pozisyon bazlı özet (sadece pozisyon adı ve sayısı) - İlk yüklemede kullan
  getPersonnelSummaryByPosition: async (useCache = true) => {
    const cacheKey = "personnel:summary:position";
    if (useCache) {
      const cached = getCached<any>(cacheKey);
      if (cached) return { data: cached };
    }
    const response = await api.get("/staff/personnel/summary/by-position");
    setCache(cacheKey, response.data);
    return response;
  },

  // Departman bazlı özet
  getPersonnelSummaryByDepartment: async (useCache = true) => {
    const cacheKey = "personnel:summary:department";
    if (useCache) {
      const cached = getCached<any>(cacheKey);
      if (cached) return { data: cached };
    }
    const response = await api.get("/staff/personnel/summary/by-department");
    setCache(cacheKey, response.data);
    return response;
  },

  // Pozisyona göre personel listesi (lazy loading - tıklandığında yükle)
  getPersonnelByPosition: async (position: string, useCache = true) => {
    const cacheKey = `personnel:position:${position}`;
    if (useCache) {
      const cached = getCached<any>(cacheKey);
      if (cached) return { data: cached };
    }
    const response = await api.get(
      `/staff/personnel/by-position/${encodeURIComponent(position)}`
    );
    setCache(cacheKey, response.data);
    return response;
  },

  // Departmana göre personel listesi (lazy loading)
  getPersonnelByDepartment: async (department: string, useCache = true) => {
    const cacheKey = `personnel:department:${department}`;
    if (useCache) {
      const cached = getCached<any>(cacheKey);
      if (cached) return { data: cached };
    }
    const response = await api.get(
      `/staff/personnel/by-department/${encodeURIComponent(department)}`
    );
    setCache(cacheKey, response.data);
    return response;
  },

  // Tek personel getir (ID ile)
  getPersonnelById: (id: string) => api.get(`/staff/personnel/${id}`),

  // Sicil numarası ile personel getir
  getPersonnelBySicilNo: (sicilNo: string) =>
    api.get(`/staff/personnel/sicil/${sicilNo}`),

  // Yeni personel oluştur
  createPersonnel: async (data: {
    sicilNo: string;
    fullName: string;
    email?: string;
    phone?: string;
    avatar?: string;
    position: string;
    department?: string;
    workLocation?: string;
    mentor?: string;
    color?: string;
    gender?: "male" | "female";
    birthDate?: string;
    age?: number;
    bloodType?: string;
    shoeSize?: number;
    sockSize?: string;
    hireDate?: string;
    terminationDate?: string;
    terminationReason?: string;
    yearsAtCompany?: number;
    isActive?: boolean;
    status?: "active" | "inactive" | "terminated";
  }) => {
    clearApiCache("personnel");
    return api.post("/staff/personnel", data);
  },

  // Personel güncelle
  updatePersonnel: async (
    id: string,
    data: {
      sicilNo?: string;
      fullName?: string;
      email?: string;
      phone?: string;
      avatar?: string;
      position?: string;
      department?: string;
      workLocation?: string;
      mentor?: string;
      color?: string;
      gender?: "male" | "female";
      birthDate?: string;
      age?: number;
      bloodType?: string;
      shoeSize?: number;
      sockSize?: string;
      hireDate?: string;
      terminationDate?: string;
      terminationReason?: string;
      yearsAtCompany?: number;
      isActive?: boolean;
      status?: "active" | "inactive" | "terminated";
    }
  ) => {
    clearApiCache("personnel");
    return api.put(`/staff/personnel/${id}`, data);
  },

  // Personel sil (soft delete)
  deletePersonnel: async (id: string) => {
    clearApiCache("personnel");
    return api.delete(`/staff/personnel/${id}`);
  },

  // Avatar yükle
  uploadPersonnelAvatar: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    clearApiCache("personnel");
    return api.post(`/staff/personnel/${id}/avatar`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // CSV'den toplu personel import et
  importPersonnelCSV: async (data: Array<Record<string, string>>) => {
    clearApiCache("personnel");
    return api.post("/staff/personnel/import-csv", { data });
  },

  // Users tablosundan Staff tablosuna migration
  migrateUsersToStaff: () => api.post("/staff/personnel/migrate"),
};

// Upload API
export const uploadApi = {
  // Avatar yükle
  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/upload/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  // Avatar sil
  deleteAvatar: (filename: string) => api.delete(`/upload/avatar/${filename}`),
  // Genel resim yükle
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/upload/image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  // Firma logosu yükle
  uploadLogo: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/upload/logo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  // Etkinlik görseli yükle
  uploadEventImage: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/upload/event-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  // Davetiye görseli yükle
  uploadInvitationImage: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/upload/invitation-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// Invitations API - Davetiye Şablonları
export const invitationsApi = {
  // Şablonlar
  getTemplates: () => api.get("/invitations/templates"),
  getDefaultTemplate: () => api.get("/invitations/templates/default"),
  getTemplate: (id: string) => api.get(`/invitations/templates/${id}`),
  createTemplate: (data: any) => api.post("/invitations/templates", data),
  updateTemplate: (id: string, data: any) =>
    api.put(`/invitations/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/invitations/templates/${id}`),
  setDefaultTemplate: (id: string) =>
    api.post(`/invitations/templates/${id}/set-default`),

  // Etkinlik Davetiyesi
  getEventInvitation: (eventId: string) =>
    api.get(`/invitations/event/${eventId}`),
  getEventInvitationElements: (eventId: string) =>
    api.get(`/invitations/event/${eventId}/elements`),
  saveEventInvitation: (eventId: string, data: any) =>
    api.post(`/invitations/event/${eventId}`, data),
  addEventImage: (eventId: string, imageUrl: string) =>
    api.post(`/invitations/event/${eventId}/images`, { imageUrl }),
  removeEventImage: (eventId: string, imageUrl: string) =>
    api.delete(`/invitations/event/${eventId}/images`, { data: { imageUrl } }),

  // Davetiye render ve gönderme
  getInvitationRenderData: (reservationId: string) =>
    api.get(`/invitations/reservation/${reservationId}/render`),
  sendInvitationEmail: (reservationId: string) =>
    api.post(`/invitations/reservation/${reservationId}/send-email`),
  getWhatsAppShareLink: (reservationId: string) =>
    api.get(`/invitations/reservation/${reservationId}/whatsapp-link`),
};

// Users API (Admin)
export const usersApi = {
  getAll: () => api.get("/users"),
  getOne: (id: string) => api.get(`/users/${id}`),
  create: (data: {
    username: string;
    email?: string;
    password: string;
    fullName: string;
    role?: string;
    phone?: string;
    position?: string;
  }) => api.post("/users", data),
  update: (
    id: string,
    data: {
      username?: string;
      email?: string;
      fullName?: string;
      role?: string;
      phone?: string;
      position?: string;
      isActive?: boolean;
      color?: string;
    }
  ) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  toggleStatus: (id: string) => api.patch(`/users/${id}/toggle-status`),
  changePassword: (
    id: string,
    data: { currentPassword?: string; newPassword: string }
  ) => api.patch(`/users/${id}/password`, data),
  getStats: () => api.get("/users/stats"),
  migrateUsernames: () => api.post("/users/migrate-usernames"),
};

// Settings API
export const settingsApi = {
  // System Settings
  get: () => api.get("/settings"),
  update: (data: any) => api.put("/settings", data),

  // Table Types
  getTableTypes: () => api.get("/settings/table-types"),
  createTableType: (data: any) => api.post("/settings/table-types", data),
  updateTableType: (id: string, data: any) =>
    api.put(`/settings/table-types/${id}`, data),
  deleteTableType: (id: string) => api.delete(`/settings/table-types/${id}`),

  // Staff Colors
  getStaffColors: () => api.get("/settings/staff-colors"),
  createStaffColor: (data: any) => api.post("/settings/staff-colors", data),
  updateStaffColor: (id: string, data: any) =>
    api.put(`/settings/staff-colors/${id}`, data),
  deleteStaffColor: (id: string) => api.delete(`/settings/staff-colors/${id}`),

  // SMTP / Mail
  testSmtpConnection: () => api.post("/settings/smtp/test"),
  sendTestEmail: (email: string) =>
    api.post("/settings/smtp/test-email", { email }),
};

// Leader API
export const leaderApi = {
  // Dashboard
  getDashboard: () => api.get("/leader/dashboard"),

  // Etkinlik detayları
  getEventDetails: (eventId: string) => api.get(`/leader/events/${eventId}`),

  // Etkinlik review izinleri
  getEventReviewPermissions: (eventId: string) =>
    api.get(`/leader/events/${eventId}/review-permissions`),

  // Review izin kontrolü (alias)
  checkReviewPermission: (eventId: string) =>
    api.get(`/leader/events/${eventId}/review-permissions`),

  // Değerlendirme için takım üyeleri
  getTeamMembersForReview: (eventId: string) =>
    api.get(`/leader/events/${eventId}/team-members`),

  // Etkinlik değerlendirmeleri
  getEventReviews: (eventId: string) =>
    api.get(`/leader/events/${eventId}/reviews`),

  // Etkinlik performans özeti
  getEventPerformanceSummary: (eventId: string) =>
    api.get(`/leader/events/${eventId}/performance-summary`),

  // Auto-save: Anlık değerlendirme kaydetme
  autoSaveReview: (
    eventId: string,
    staffId: string,
    data: {
      categoryScores?: {
        communication: number;
        punctuality: number;
        teamwork: number;
        customerService: number;
        technicalSkills: number;
        initiative: number;
        appearance: number;
        stressManagement: number;
      };
      strengths?: string[];
      improvements?: string[];
      comment?: string;
      privateNotes?: string;
      nextEventNotes?: string;
    }
  ) => api.post("/leader/reviews/auto-save", { staffId, eventId, ...data }),

  // Tek değerlendirme oluştur
  createReview: (data: {
    staffId: string;
    eventId: string;
    categoryScores?: {
      communication: number;
      punctuality: number;
      teamwork: number;
      customerService: number;
      technicalSkills: number;
      initiative: number;
      appearance: number;
      stressManagement: number;
    };
    strengths?: string[];
    improvements?: string[];
    comment?: string;
    privateNotes?: string;
    nextEventNotes?: string;
    isCompleted?: boolean;
  }) => api.post("/leader/reviews", data),

  // Toplu değerlendirme
  createBulkReviews: (
    eventId: string,
    reviews: Array<{
      staffId: string;
      categoryScores?: {
        communication: number;
        punctuality: number;
        teamwork: number;
        customerService: number;
        technicalSkills: number;
        initiative: number;
        appearance: number;
        stressManagement: number;
      };
      strengths?: string[];
      improvements?: string[];
      comment?: string;
      privateNotes?: string;
      nextEventNotes?: string;
      isCompleted?: boolean;
    }>
  ) => api.post(`/leader/events/${eventId}/reviews/bulk`, { reviews }),

  // Tek değerlendirmeyi tamamla
  completeReview: (eventId: string, staffId: string) =>
    api.patch(`/leader/events/${eventId}/reviews/${staffId}/complete`),

  // Tüm değerlendirmeleri tamamla
  completeAllReviews: (eventId: string) =>
    api.patch(`/leader/events/${eventId}/reviews/complete-all`),

  // Personel değerlendirme geçmişi
  getStaffReviews: (staffId: string) =>
    api.get(`/leader/staff/${staffId}/reviews`),

  // Personel performans analizi
  getStaffPerformanceAnalysis: (staffId: string) =>
    api.get(`/leader/staff/${staffId}/performance-analysis`),

  // Tüm personellerin değerlendirme özetleri
  getAllStaffReviewsSummary: () => api.get("/leader/staff-reviews-summary"),

  // Personelin atandığı etkinlikler ve değerlendirmeleri
  getStaffEventReviews: (staffId: string) =>
    api.get(`/leader/staff/${staffId}/event-reviews`),
};

// Admin API
export const adminApi = {
  // Sistem istatistikleri
  getStats: () => api.get("/admin/stats"),

  // Etkinlik review ayarları
  getAllEventsReviewSettings: () => api.get("/admin/events/review-settings"),
  getEventReviewSettings: (eventId: string) =>
    api.get(`/admin/events/${eventId}/review-settings`),
  updateEventReviewSettings: (
    eventId: string,
    settings: { reviewEnabled?: boolean; reviewHistoryVisible?: boolean }
  ) => api.patch(`/admin/events/${eventId}/review-settings`, settings),
  bulkUpdateReviewSettings: (
    eventIds: string[],
    settings: { reviewEnabled?: boolean; reviewHistoryVisible?: boolean }
  ) => api.post("/admin/events/review-settings/bulk", { eventIds, settings }),
};

// Health API
export const healthApi = {
  // Basit health check
  check: () => api.get("/health"),
  // Detaylı health check
  detailed: () => api.get("/health/detailed"),
  // Sistem metrikleri
  metrics: () => api.get("/health/metrics"),
};

// Notifications API
export const notificationsApi = {
  // Kullanıcının bildirimlerini getir
  getNotifications: (options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());
    if (options?.unreadOnly) params.append("unreadOnly", "true");
    return api.get(`/notifications?${params.toString()}`);
  },

  // Okunmamış bildirim sayısı
  getUnreadCount: () => api.get("/notifications/unread-count"),

  // Tek bildirim detayı
  getNotification: (id: string) => api.get(`/notifications/${id}`),

  // Bildirimi okundu olarak işaretle
  markAsRead: (id: string) => api.post(`/notifications/${id}/read`),

  // Tüm bildirimleri okundu olarak işaretle
  markAllAsRead: () => api.post("/notifications/mark-all-read"),

  // Admin: Tüm bildirimleri getir
  getAllNotifications: (options?: {
    limit?: number;
    offset?: number;
    type?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());
    if (options?.type) params.append("type", options.type);
    return api.get(`/notifications/admin/all?${params.toString()}`);
  },

  // Admin: Bildirim istatistikleri
  getNotificationStats: (id: string) =>
    api.get(`/notifications/admin/${id}/stats`),

  // Admin: Bildirimi sil
  deleteNotification: (id: string) =>
    api.post(`/notifications/admin/${id}/delete`),
};

// Positions API (Unvanlar)
export const positionsApi = {
  getAll: (all = false) => api.get(`/staff/positions${all ? "?all=true" : ""}`),
  create: (data: { name: string; description?: string }) =>
    api.post("/staff/positions", data),
  update: (
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) => api.put(`/staff/positions/${id}`, data),
  delete: (id: string) => api.delete(`/staff/positions/${id}`),
};

// Departments API (Bölümler)
export const departmentsApi = {
  getAll: (all = false) =>
    api.get(`/staff/departments${all ? "?all=true" : ""}`),
  getAllWithRelations: () => api.get("/staff/departments-with-relations"),
  getDetails: (id: string) => api.get(`/staff/departments/${id}/details`),
  getPositions: (id: string) => api.get(`/staff/departments/${id}/positions`),
  getLocations: (id: string) => api.get(`/staff/departments/${id}/locations`),
  create: (data: { name: string; description?: string; color?: string }) =>
    api.post("/staff/departments", data),
  update: (
    id: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) => api.put(`/staff/departments/${id}`, data),
  delete: (id: string) => api.delete(`/staff/departments/${id}`),
  updatePositions: (id: string, positionIds: string[]) =>
    api.put(`/staff/departments/${id}/positions`, { positionIds }),
  updateLocations: (id: string, locationIds: string[]) =>
    api.put(`/staff/departments/${id}/locations`, { locationIds }),
};

// Work Locations API (Görev Yerleri)
export const workLocationsApi = {
  getAll: (all = false) =>
    api.get(`/staff/work-locations${all ? "?all=true" : ""}`),
  create: (data: { name: string; description?: string; address?: string }) =>
    api.post("/staff/work-locations", data),
  update: (
    id: string,
    data: {
      name?: string;
      description?: string;
      address?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) => api.put(`/staff/work-locations/${id}`, data),
  delete: (id: string) => api.delete(`/staff/work-locations/${id}`),
};

// Sync Relations API
export const syncApi = {
  syncRelations: () => api.post("/staff/sync-relations"),
};

// ==================== SERVICE POINTS API ====================
// Hizmet Noktaları (Bar, Lounge, Karşılama vb.)
export const servicePointsApi = {
  // Etkinliğe ait tüm hizmet noktalarını getir
  getAll: (eventId: string) => api.get(`/events/${eventId}/service-points`),

  // Tek bir hizmet noktasını getir
  getOne: (eventId: string, id: string) =>
    api.get(`/events/${eventId}/service-points/${id}`),

  // Yeni hizmet noktası oluştur
  create: (
    eventId: string,
    data: {
      name: string;
      pointType?: string; // bar, lounge, reception, vip_area, backstage, other
      requiredStaffCount?: number;
      allowedRoles?: string[]; // barman, hostes, garson, barboy, security
      x?: number;
      y?: number;
      color?: string;
      shape?: string; // square, circle, rectangle
      description?: string;
      sortOrder?: number;
    }
  ) => api.post(`/events/${eventId}/service-points`, data),

  // Hizmet noktasını güncelle
  update: (
    eventId: string,
    id: string,
    data: {
      name?: string;
      pointType?: string;
      requiredStaffCount?: number;
      allowedRoles?: string[];
      x?: number;
      y?: number;
      color?: string;
      shape?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) => api.put(`/events/${eventId}/service-points/${id}`, data),

  // Hizmet noktasını sil
  delete: (eventId: string, id: string) =>
    api.delete(`/events/${eventId}/service-points/${id}`),

  // ==================== STAFF ASSIGNMENTS ====================

  // Hizmet noktasına ait personel atamalarını getir
  getAssignments: (eventId: string, servicePointId: string) =>
    api.get(`/events/${eventId}/service-points/${servicePointId}/assignments`),

  // Etkinliğe ait tüm hizmet noktası personel atamalarını getir
  getAllAssignments: (eventId: string) =>
    api.get(`/events/${eventId}/service-points/assignments/all`),

  // Personel ataması oluştur
  createAssignment: (
    eventId: string,
    data: {
      servicePointId: string;
      staffId: string;
      role: string; // barman, hostes, garson, barboy, security
      shiftId?: string;
      shiftStart?: string; // "18:00"
      shiftEnd?: string; // "02:00"
      notes?: string;
      sortOrder?: number;
    }
  ) => api.post(`/events/${eventId}/service-points/assignments`, data),

  // Toplu personel ataması oluştur
  createBulkAssignments: (
    eventId: string,
    assignments: Array<{
      servicePointId: string;
      staffId: string;
      role: string;
      shiftId?: string;
      shiftStart?: string;
      shiftEnd?: string;
      notes?: string;
      sortOrder?: number;
    }>
  ) =>
    api.post(`/events/${eventId}/service-points/assignments/bulk`, {
      assignments,
    }),

  // Personel atamasını güncelle
  updateAssignment: (
    eventId: string,
    assignmentId: string,
    data: {
      role?: string;
      shiftId?: string;
      shiftStart?: string;
      shiftEnd?: string;
      notes?: string;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) =>
    api.put(
      `/events/${eventId}/service-points/assignments/${assignmentId}`,
      data
    ),

  // Personel atamasını sil
  deleteAssignment: (eventId: string, assignmentId: string) =>
    api.delete(`/events/${eventId}/service-points/assignments/${assignmentId}`),

  // ==================== STATISTICS ====================

  // Etkinlik için hizmet noktası istatistikleri
  getStats: (eventId: string) =>
    api.get(`/events/${eventId}/service-points/stats/summary`),
};

// ==================== EVENT EXTRA STAFF API ====================
// Etkinlik Ekstra Personel (Geçici personeller)
export const eventExtraStaffApi = {
  // Etkinliğe ait tüm ekstra personelleri getir
  getAll: (eventId: string) => api.get(`/events/${eventId}/extra-staff`),

  // Yeni ekstra personel ekle
  create: (
    eventId: string,
    data: {
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
    }
  ) => api.post(`/events/${eventId}/extra-staff`, data),

  // Ekstra personeli güncelle
  update: (
    eventId: string,
    extraStaffId: string,
    data: {
      fullName?: string;
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
    }
  ) => api.put(`/events/${eventId}/extra-staff/${extraStaffId}`, data),

  // Ekstra personeli sil
  delete: (eventId: string, extraStaffId: string) =>
    api.delete(`/events/${eventId}/extra-staff/${extraStaffId}`),

  // Toplu ekstra personel kaydet (mevcut olanları sil, yenilerini ekle)
  saveBulk: (
    eventId: string,
    extraStaff: Array<{
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
    }>
  ) => api.post(`/events/${eventId}/extra-staff/bulk`, { extraStaff }),
};

// ==================== CHECK-IN API ====================
// Check-in modülü için özel API fonksiyonları
export const checkInApi = {
  // Bugünün aktif etkinliklerini getir
  getActiveEvents: () => api.get("/events/active/today"),

  // Check-in için etkinlik detayları ve rezervasyonları getir
  getEventForCheckIn: (eventId: string) =>
    api.get(`/reservations/event/${eventId}/check-in-data`),

  // QR kod ile check-in (mevcut reservationsApi.checkIn kullanır)
  checkIn: (qrCodeHash: string) =>
    api.post(`/reservations/check-in/${qrCodeHash}`),

  // Manuel arama (isim veya telefon ile)
  searchForCheckIn: (query: string, eventId: string) => {
    const params = new URLSearchParams({ q: query, eventId });
    return api.get(`/reservations/search?${params.toString()}`);
  },

  // Walk-in misafir kaydı
  registerWalkIn: (data: {
    eventId: string;
    guestName: string;
    guestCount: number;
    tableId: string;
    phone?: string;
  }) => api.post("/reservations/walk-in", data),

  // Check-in geçmişi
  getCheckInHistory: (eventId: string, limit = 20) =>
    api.get(`/reservations/event/${eventId}/check-in-history?limit=${limit}`),

  // Etkinlik istatistikleri (mevcut reservationsApi.getEventStats kullanır)
  getEventStats: (eventId: string) =>
    api.get(`/reservations/event/${eventId}/stats`),

  // Kişi sayısı güncelle
  updateGuestCount: (reservationId: string, guestCount: number) =>
    api.patch(`/reservations/${reservationId}/guest-count`, { guestCount }),

  // QR kod ile rezervasyon getir (mevcut reservationsApi.getByQRCode kullanır)
  getByQRCode: (qrCodeHash: string) =>
    api.get(`/reservations/qr/${qrCodeHash}`),

  // Müsait masaları getir (walk-in için)
  getAvailableTables: (eventId: string) =>
    api.get(`/reservations/event/${eventId}/available-tables`),
};
