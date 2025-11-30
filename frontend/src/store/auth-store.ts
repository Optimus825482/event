import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/lib/api";

// Modül tipleri
export type ModuleType = "events" | "reservations" | "checkin";

export interface ModuleInfo {
  id: ModuleType;
  name: string;
  description: string;
  icon: string;
  path: string;
}

export const MODULES: Record<ModuleType, ModuleInfo> = {
  events: {
    id: "events",
    name: "Etkinlik Planlama",
    description: "Etkinlik oluşturma, masa yerleşimi ve personel yönetimi",
    icon: "Calendar",
    path: "/dashboard",
  },
  reservations: {
    id: "reservations",
    name: "Rezervasyon",
    description: "Misafir rezervasyonları ve QR bilet yönetimi",
    icon: "Ticket",
    path: "/reservations",
  },
  checkin: {
    id: "checkin",
    name: "Check-in",
    description: "QR kod okutma ve giriş kontrolü",
    icon: "QrCode",
    path: "/check-in",
  },
};

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: "admin" | "organizer" | "staff";
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
    password: "admin123",
    user: {
      id: "1",
      username: "admin",
      fullName: "Admin Kullanıcı",
      role: "admin",
      allowedModules: ["events", "reservations", "checkin"],
    },
  },
  organizer: {
    password: "org123",
    user: {
      id: "2",
      username: "organizer",
      fullName: "Organizatör",
      role: "organizer",
      allowedModules: ["events", "reservations"],
    },
  },
  staff: {
    password: "staff123",
    user: {
      id: "3",
      username: "staff",
      fullName: "Personel",
      role: "staff",
      allowedModules: ["checkin"],
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

      login: async (email: string, password: string) => {
        try {
          // Gerçek API login
          const response = await authApi.login(email, password);
          const { token, user } = response.data;

          set({
            user: {
              id: user.id,
              username: user.email,
              fullName: user.fullName,
              role: user.role || "admin",
              allowedModules: ["events", "reservations", "checkin"],
            },
            token: token,
            isAuthenticated: true,
            activeModule: null,
          });
          return true;
        } catch (error) {
          // API başarısız olursa mock login dene (geliştirme için)
          const mockUser = MOCK_USERS[email.toLowerCase()];
          if (mockUser && mockUser.password === password) {
            set({
              user: mockUser.user,
              token: `mock-token-${Date.now()}`,
              isAuthenticated: true,
              activeModule: null,
            });
            return true;
          }
          return false;
        }
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
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        activeModule: state.activeModule,
      }),
    }
  )
);
