"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Calendar,
  Ticket,
  QrCode,
  Shield,
  LogOut,
  Users,
  Loader2,
} from "lucide-react";
import { useAuthStore, MODULES, ModuleType } from "@/store/auth-store";

const iconMap = {
  Calendar,
  Ticket,
  QrCode,
  Shield,
  Users,
};

// Modül renk konfigürasyonu
const moduleColors: Record<
  ModuleType,
  { gradient: string; iconBg: string; border: string; glow: string }
> = {
  events: {
    gradient: "from-blue-500/20 via-blue-600/10 to-transparent",
    iconBg: "bg-blue-600/20",
    border: "border-blue-500/30 hover:border-blue-400/60",
    glow: "hover:shadow-blue-500/20",
  },
  reservations: {
    gradient: "from-purple-500/20 via-purple-600/10 to-transparent",
    iconBg: "bg-purple-600/20",
    border: "border-purple-500/30 hover:border-purple-400/60",
    glow: "hover:shadow-purple-500/20",
  },
  checkin: {
    gradient: "from-emerald-500/20 via-emerald-600/10 to-transparent",
    iconBg: "bg-emerald-600/20",
    border: "border-emerald-500/30 hover:border-emerald-400/60",
    glow: "hover:shadow-emerald-500/20",
  },
  admin: {
    gradient: "from-amber-500/20 via-amber-600/10 to-transparent",
    iconBg: "bg-amber-600/20",
    border: "border-amber-500/30 hover:border-amber-400/60",
    glow: "hover:shadow-amber-500/20",
  },
  leader: {
    gradient: "from-cyan-500/20 via-cyan-600/10 to-transparent",
    iconBg: "bg-cyan-600/20",
    border: "border-cyan-500/30 hover:border-cyan-400/60",
    glow: "hover:shadow-cyan-500/20",
  },
};

const iconColors: Record<ModuleType, string> = {
  events: "text-blue-400",
  reservations: "text-purple-400",
  checkin: "text-emerald-400",
  admin: "text-amber-400",
  leader: "text-cyan-400",
};

export default function SelectModulePage() {
  const router = useRouter();
  const { user, isAuthenticated, setActiveModule, logout } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydration tamamlanana kadar bekle
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // Hydration tamamlanmadan kontrol yapma
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    // Leader kullanıcıları kendi paneline yönlendir
    if (user?.role === "leader") {
      router.replace("/leader");
      return;
    }

    // Controller kullanıcıları direkt check-in'e yönlendir (sadece bu modüle erişebilirler)
    if (user?.role === "controller") {
      router.replace("/check-in");
      return;
    }
  }, [isHydrated, isAuthenticated, user, router]);

  // Hydration beklerken loading göster
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const handleSelectModule = (moduleId: ModuleType) => {
    setActiveModule(moduleId);
    router.push(MODULES[moduleId].path);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Kullanıcının erişebildiği modüller
  const allowedModules = user.allowedModules
    .map((id) => MODULES[id])
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Image
            src="/eventflowprologo.png"
            alt="EventFlow PRO"
            width={160}
            height={42}
            className="h-8 sm:h-10 w-auto"
            priority
          />
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-slate-400 text-sm sm:text-base">
                Hoş geldin,{" "}
                <span className="text-white font-medium">{user.fullName}</span>
              </span>
              {user.role === "admin" && (
                <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Admin
                </span>
              )}
            </div>
            {/* Mobile: Sadece isim ve badge */}
            <div className="flex sm:hidden items-center gap-2">
              <span className="text-white font-medium text-sm truncate max-w-[100px]">
                {user.fullName.split(" ")[0]}
              </span>
              {user.role === "admin" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Admin
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl w-full">
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 text-white">
              Modül Seçin
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Çalışmak istediğiniz modülü seçerek devam edin
            </p>
          </div>

          {/* Tüm Modüller - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
            {allowedModules.map((module) => {
              const Icon = iconMap[module.icon as keyof typeof iconMap];
              const colors = moduleColors[module.id];
              const iconColor = iconColors[module.id];

              return (
                <button
                  key={module.id}
                  onClick={() => handleSelectModule(module.id)}
                  className={`
                    relative overflow-hidden
                    bg-gradient-to-br ${colors.gradient} 
                    p-5 sm:p-6 lg:p-7
                    rounded-xl sm:rounded-2xl 
                    border ${colors.border} 
                    text-left 
                    transition-all duration-300 ease-out
                    group 
                    hover:scale-[1.02] active:scale-[0.98]
                    hover:shadow-xl ${colors.glow}
                    backdrop-blur-sm
                  `}
                >
                  {/* Subtle glow effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div
                      className={`absolute -inset-1 bg-gradient-to-br ${colors.gradient} blur-xl`}
                    />
                  </div>

                  <div className="relative z-10">
                    <div
                      className={`
                        w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 
                        ${colors.iconBg} 
                        rounded-lg sm:rounded-xl 
                        flex items-center justify-center 
                        mb-4 sm:mb-5 lg:mb-6 
                        group-hover:scale-110 
                        transition-transform duration-300
                      `}
                    >
                      <Icon
                        className={`w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 ${iconColor}`}
                      />
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-1.5 sm:mb-2 text-white">
                      {module.name}
                    </h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                      {module.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {allowedModules.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                <Shield className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-lg mb-2">
                Erişim izniniz olan modül bulunmuyor.
              </p>
              <p className="text-sm">Lütfen yöneticinizle iletişime geçin.</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-3 sm:py-4 text-center text-slate-500 text-xs sm:text-sm">
        EventFlow PRO © 2025 - Tüm hakları saklıdır
      </footer>
    </div>
  );
}
