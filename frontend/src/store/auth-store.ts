import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/lib/api";

// Modül tipleri - admin modülü eklendi
export type ModuleType = "events" | "reservations" | "checkin" | "admin";

export interface ModuleInfo {
  id: ModuleType;
  name: string;
  description: string;
  icon: string;
  path: string;
  adminOnly?: boolean;
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
  admin: {
    id: "admin",
    name: "Sistem Yönetimi",
    description: "Kullanıcı yönetimi, sistem ayarları ve raporlar",
    icon: "Shield",
    path: "/admin",
    adminOnly: true,
  },
};

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: "admin" | "organizer" | "leader" | "staff" | "supervizor";
  allowedModules: ModuleType[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  activeModule: ModuleType | null;
  isAuthenticated: boolean;

  // Actions
  login: (username: string, password: string) => Promise<string | false>;
  logout: () => void;
  setActiveModule: (module: ModuleType) => void;
  clearActiveModule: () => void;
}

// Mock kullanıcılar - admin artık admin modülüne de erişebilir
const MOCK_USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: "admin123",
    user: {
      id: "1",
      username: "admin",
      fullName: "Admin Kullanıcı",
      role: "admin",
      allowedModules: ["events", "reservations", "checkin", "admin"],
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

      login: async (username: string, password: string) => {
        try {
          // Gerçek API login
          const response = await authApi.login(username, password);
          const { token, user } = response.data;

          console.log("Login response user:", user);
          console.log("User role:", user.role);

          // Admin kullanıcıları için admin modülünü de ekle
          const allowedModules: ModuleType[] = [
            "events",
            "reservations",
            "checkin",
          ];
          if (user.role === "admin") {
            allowedModules.push("admin");
          }

          const userData: User = {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role || "staff",
            allowedModules,
          };

          set({
            user: userData,
            token: token,
            isAuthenticated: true,
            activeModule: null,
          });

          // Role'ü döndür ki login sayfası yönlendirme yapabilsin
          const returnRole = user.role || "staff";
          console.log("Returning role:", returnRole);
          return returnRole;
        } catch (error) {
          console.error("Login error:", error);
          // API başarısız olursa mock login dene (geliştirme için)
          const mockUser = MOCK_USERS[username.toLowerCase()];
          if (mockUser && mockUser.password === password) {
            set({
              user: mockUser.user,
              token: `mock-token-${Date.now()}`,
              isAuthenticated: true,
              activeModule: null,
            });
            return mockUser.user.role;
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
