import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Modül tipleri
export type ModuleType = 'events' | 'reservations' | 'checkin';

export interface ModuleInfo {
  id: ModuleType;
  name: string;
  description: string;
  icon: string;
  path: string;
}

export const MODULES: Record<ModuleType, ModuleInfo> = {
  events: {
    id: 'events',
    name: 'Etkinlik Planlama',
    description: 'Etkinlik oluşturma, masa yerleşimi ve personel yönetimi',
    icon: 'Calendar',
    path: '/events',
  },
  reservations: {
    id: 'reservations',
    name: 'Rezervasyon',
    description: 'Müşteri rezervasyonları ve QR bilet yönetimi',
    icon: 'Ticket',
    path: '/reservations',
  },
  checkin: {
    id: 'checkin',
    name: 'Check-in',
    description: 'QR kod okutma ve giriş kontrolü',
    icon: 'QrCode',
    path: '/check-in',
  },
};

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'admin' | 'organizer' | 'staff';
  allowedModules: ModuleType[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  activeModule: ModuleType | null;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setActiveModule: (module: ModuleType) => void;
  clearActiveModule: () => void;
}

// Mock kullanıcılar
const MOCK_USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: 'admin123',
    user: {
      id: '1',
      username: 'admin',
      fullName: 'Admin Kullanıcı',
      role: 'admin',
      allowedModules: ['events', 'reservations', 'checkin'],
    },
  },
  organizer: {
    password: 'org123',
    user: {
      id: '2',
      username: 'organizer',
      fullName: 'Organizatör',
      role: 'organizer',
      allowedModules: ['events', 'reservations'],
    },
  },
  staff: {
    password: 'staff123',
    user: {
      id: '3',
      username: 'staff',
      fullName: 'Personel',
      role: 'staff',
      allowedModules: ['checkin'],
    },
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      activeModule: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        // Mock login - gerçekte API çağrısı yapılacak
        const mockUser = MOCK_USERS[username.toLowerCase()];

        if (mockUser && mockUser.password === password) {
          set({
            user: mockUser.user,
            token: `mock-token-${Date.now()}`,
            isAuthenticated: true,
            activeModule: null, // Modül seçimi için null
          });
          return true;
        }
        return false;
      },

      logout: () => {
        set({
          user: null,
          token: null,
          activeModule: null,
          isAuthenticated: false,
        });
      },

      setActiveModule: (module: ModuleType) => {
        set({ activeModule: module });
      },

      clearActiveModule: () => {
        set({ activeModule: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        activeModule: state.activeModule,
      }),
    }
  )
);
