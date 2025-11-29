import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token interceptor
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Zustand persist storage'dan token al
    const authStorage = localStorage.getItem('auth-storage');
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
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; fullName: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// Events API
export const eventsApi = {
  getAll: () => api.get('/events'),
  getOne: (id: string) => api.get(`/events/${id}`),
  create: (data: any) => api.post('/events', data),
  update: (id: string, data: any) => api.put(`/events/${id}`, data),
  delete: (id: string) => api.delete(`/events/${id}`),
  updateLayout: (id: string, layout: any) =>
    api.patch(`/events/${id}/layout`, { layout }),
};

// Tables API
export const tablesApi = {
  getTypes: () => api.get('/tables/types'),
  createType: (data: any) => api.post('/tables/types', data),
  updateType: (id: string, data: any) => api.put(`/tables/types/${id}`, data),
  deleteType: (id: string) => api.delete(`/tables/types/${id}`),
  seedDefaults: () => api.post('/tables/seed'),
};

// Customers API
export const customersApi = {
  getAll: () => api.get('/customers'),
  getOne: (id: string) => api.get(`/customers/${id}`),
  search: (query: string) => api.get(`/customers/search?q=${query}`),
  create: (data: any) => api.post('/customers', data),
  update: (id: string, data: any) => api.put(`/customers/${id}`, data),
};

// Reservations API
export const reservationsApi = {
  getByEvent: (eventId: string) => api.get(`/reservations/event/${eventId}`),
  create: (data: any) => api.post('/reservations', data),
  update: (id: string, data: any) => api.put(`/reservations/${id}`, data),
  checkIn: (id: string) => api.post(`/reservations/${id}/check-in`),
  verifyQR: (hash: string) => api.post('/reservations/verify-qr', { hash }),
};

// Venues API
export const venuesApi = {
  getAll: () => api.get('/venues'),
  getMarketplace: () => api.get('/venues/marketplace'),
  getOne: (id: string) => api.get(`/venues/${id}`),
  create: (data: any) => api.post('/venues', data),
  update: (id: string, data: any) => api.put(`/venues/${id}`, data),
};

// Staff API
export const staffApi = {
  getAll: () => api.get('/staff'),
  getEventAssignments: (eventId: string) => api.get(`/staff/event/${eventId}`),
  assignTables: (data: { eventId: string; staffId: string; tableIds: string[] }) =>
    api.post('/staff/assign', data),
};

// Settings API
export const settingsApi = {
  // System Settings
  get: () => api.get('/settings'),
  update: (data: any) => api.put('/settings', data),
  
  // Table Types
  getTableTypes: () => api.get('/settings/table-types'),
  createTableType: (data: any) => api.post('/settings/table-types', data),
  updateTableType: (id: string, data: any) => api.put(`/settings/table-types/${id}`, data),
  deleteTableType: (id: string) => api.delete(`/settings/table-types/${id}`),
  
  // Staff Colors
  getStaffColors: () => api.get('/settings/staff-colors'),
  createStaffColor: (data: any) => api.post('/settings/staff-colors', data),
  updateStaffColor: (id: string, data: any) => api.put(`/settings/staff-colors/${id}`, data),
  deleteStaffColor: (id: string) => api.delete(`/settings/staff-colors/${id}`),
};
