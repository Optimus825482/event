import axios from "axios";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
export const API_BASE = API_URL.replace("/api", ""); // http://localhost:4000

// Simple in-memory cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 saniye cache süresi

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
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // JSON parse hatası
      }
    }
  }
  return config;
});

// Response interceptor - 401 hatalarında login'e yönlendirme YAPMA
// Çünkü backend henüz hazır olmayabilir, varsayılan değerler kullanılacak
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Network hatası veya backend kapalıysa sessizce devam et
    if (!error.response) {
      return Promise.reject(error);
    }
    // 401 hatası - sadece reject et, login'e yönlendirme
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
  getAllWithStats: (search?: string) =>
    api.get(`/customers/list/with-stats${search ? `?search=${search}` : ""}`),
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
  updateTeam: (
    teamId: string,
    data: {
      name?: string;
      color?: string;
      memberIds?: string[];
      leaderId?: string;
    }
  ) => api.put(`/staff/teams/${teamId}`, data),

  // Ekip sil
  deleteTeam: (teamId: string) => api.delete(`/staff/teams/${teamId}`),

  // Ekibe üye ekle
  addMemberToTeam: (teamId: string, data: { memberId: string }) =>
    api.post(`/staff/teams/${teamId}/members`, data),

  // Ekipten üye çıkar
  removeMemberFromTeam: (teamId: string, memberId: string) =>
    api.delete(`/staff/teams/${teamId}/members/${memberId}`),

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

  // Tüm çalışma saatlerini getir
  getShifts: () => api.get("/staff/shifts"),

  // Yeni çalışma saati oluştur
  createShift: (data: {
    name: string;
    startTime: string;
    endTime: string;
    color?: string;
  }) => api.post("/staff/shifts", data),

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

  // Tüm ekipleri getir (yeni teams tablosu)
  getTeams: () => api.get("/staff/teams"),

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
    api.get(`/staff/event/${eventId}/staff-assignments`),

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
  ) => api.post(`/staff/event/${eventId}/staff-assignments`, data),

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
  ) => api.put(`/staff/staff-assignments/${assignmentId}`, data),

  // Personel atamasını kaldır
  removeStaffAssignment: (assignmentId: string) =>
    api.delete(`/staff/staff-assignments/${assignmentId}`),

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
  ) =>
    api.post(`/staff/event/${eventId}/staff-assignments/save`, { assignments }),

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
