import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/lib/api";

// Modül tipleri - admin modülü eklendi
export type ModuleType =
  | "events"
  | "reservations"
  | "checkin"
  | "admin"
  | "leader";

export interface ModuleInfo {
  id: ModuleType;
  name: string;
  description: string;
  icon: string;
  path: string;
  roles?: string[]; // İzin verilen roller
}

export const MODULES: Record<ModuleType, ModuleInfo> = {
  events: {
    id: "events",
    name: "Etkinlik Planlama",
    description: "Etkinlik oluşturma, masa yerleşimi ve personel yönetimi",
    icon: "Calendar",
    path: "/dashboard",
    roles: ["admin", "organizer"],
  },
  reservations: {
    id: "reservations",
    name: "Rezervasyon",
    description: "Misafir rezervasyonları ve QR bilet yönetimi",
    icon: "Ticket",
    path: "/reservations",
    roles: ["admin", "organizer", "staff"],
  },
  checkin: {
    id: "checkin",
    name: "Check-in",
    description: "QR kod okutma ve giriş kontrolü",
    icon: "QrCode",
    path: "/check-in",
    roles: ["admin", "organizer", "staff", "leader"],
  },
  admin: {
    id: "admin",
    name: "Sistem Yönetimi",
    description: "Kullanıcı yönetimi, sistem ayarları ve raporlar",
    icon: "Shield",
    path: "/admin",
    roles: ["admin"],
  },
  leader: {
    id: "leader",
    name: "Ekip Lideri",
    description: "Ekip yönetimi ve performans değerlendirme",
    icon: "Users",
    path: "/leader",
    roles: ["leader"], // Sadece leader rolü - admin select-module'de görmez
  },
};

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: "admin" | "organizer" | "leader" | "staff" | "venue_owner";
  allowedModules: ModuleType[];
  avatar?: string;
  email?: string;
  phone?: string;
  position?: string;
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
  getAllowedModules: () => ModuleInfo[];
}

/**
 * Kullanıcı rolüne göre izin verilen modülleri hesapla
 */
function calculateAllowedModules(role: string): ModuleType[] {
  const allowed: ModuleType[] = [];

  for (const [moduleId, moduleInfo] of Object.entries(MODULES)) {
    if (moduleInfo.roles?.includes(role)) {
      allowed.push(moduleId as ModuleType);
    }
  }

  return allowed;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      activeModule: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        try {
          // API login
          const response = await authApi.login(username, password);
          const { token, user } = response.data;

          // Rol bazlı modül erişimi hesapla
          const allowedModules = calculateAllowedModules(user.role);

          const userData: User = {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role || "staff",
            allowedModules,
            avatar: user.avatar,
            email: user.email,
            phone: user.phone,
            position: user.position,
          };

          set({
            user: userData,
            token: token,
            isAuthenticated: true,
            activeModule: null,
          });

          return user.role || "staff";
        } catch (error) {
          console.error("Login error:", error);
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
        const { user } = get();
        // Modül erişim kontrolü
        if (user && user.allowedModules.includes(module)) {
          set({ activeModule: module });
        } else {
          console.warn(`Unauthorized module access attempt: ${module}`);
        }
      },

      clearActiveModule: () => {
        set({ activeModule: null });
      },

      getAllowedModules: () => {
        const { user } = get();
        if (!user) return [];

        return user.allowedModules
          .map((moduleId) => MODULES[moduleId])
          .filter(Boolean);
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
