import axios from "axios";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
export const API_BASE = API_URL.replace("/api", ""); // http://localhost:4000

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
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (data: { email: string; password: string; fullName: string }) =>
    api.post("/auth/register", data),
  me: () => api.get("/auth/me"),
};

// Events API
export const eventsApi = {
  getAll: () => api.get("/events"),
  getOne: (id: string) => api.get(`/events/${id}`),
  create: (data: any) => api.post("/events", data),
  update: (id: string, data: any) => api.put(`/events/${id}`, data),
  delete: (id: string) => api.delete(`/events/${id}`),
  updateLayout: (id: string, layout: any) =>
    api.patch(`/events/${id}/layout`, { layout }),
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

// Venues API
export const venuesApi = {
  getAll: () => api.get("/venues"),
  getMarketplace: () => api.get("/venues/marketplace"),
  getOne: (id: string) => api.get(`/venues/${id}`),
  create: (data: any) => api.post("/venues", data),
  update: (id: string, data: any) => api.put(`/venues/${id}`, data),
  delete: (id: string) => api.delete(`/venues/${id}`),
};

// Staff pozisyon tipleri
export type StaffPosition =
  | "supervizor"
  | "sef"
  | "garson"
  | "komi"
  | "debarasor";

// Staff API
export const staffApi = {
  // Personel CRUD
  getAll: (activeOnly?: boolean) =>
    api.get(`/staff${activeOnly ? "?active=true" : ""}`),
  getOne: (id: string) => api.get(`/staff/${id}`),
  create: (data: {
    email: string;
    fullName: string;
    password: string;
    phone?: string;
    color?: string;
    position?: StaffPosition;
    avatar?: string;
  }) => api.post("/staff", data),
  update: (
    id: string,
    data: {
      fullName?: string;
      phone?: string;
      color?: string;
      position?: StaffPosition;
      avatar?: string;
      isActive?: boolean;
    }
  ) => api.put(`/staff/${id}`, data),
  delete: (id: string) => api.delete(`/staff/${id}`),

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
    eventId: string;
    name: string;
    color: string;
    members?: any[];
    leaderId?: string;
    tableIds?: string[];
  }) => api.post("/staff/teams", data),

  // Ekip güncelle
  updateTeam: (
    teamId: string,
    data: {
      name?: string;
      color?: string;
      members?: any[];
      leaderId?: string;
      tableIds?: string[];
    }
  ) => api.put(`/staff/teams/${teamId}`, data),

  // Ekip sil
  deleteTeam: (teamId: string) => api.delete(`/staff/teams/${teamId}`),

  // Ekibe üye ekle
  addMemberToTeam: (teamId: string, member: any) =>
    api.post(`/staff/teams/${teamId}/members`, member),

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
