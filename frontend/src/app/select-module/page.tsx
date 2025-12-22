"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Calendar, Ticket, QrCode, Shield, LogOut } from "lucide-react";
import { useAuthStore, MODULES, ModuleType } from "@/store/auth-store";

const iconMap = {
  Calendar,
  Ticket,
  QrCode,
  Shield,
};

// Modül renk konfigürasyonu
const moduleColors: Record<
  ModuleType,
  { gradient: string; iconBg: string; border: string }
> = {
  events: {
    gradient: "from-blue-500/20 to-blue-600/10",
    iconBg: "bg-blue-600/20",
    border: "border-blue-500/30 hover:border-blue-500/50",
  },
  reservations: {
    gradient: "from-purple-500/20 to-purple-600/10",
    iconBg: "bg-purple-600/20",
    border: "border-purple-500/30 hover:border-purple-500/50",
  },
  checkin: {
    gradient: "from-emerald-500/20 to-emerald-600/10",
    iconBg: "bg-emerald-600/20",
    border: "border-emerald-500/30 hover:border-emerald-500/50",
  },
  admin: {
    gradient: "from-amber-500/20 to-amber-600/10",
    iconBg: "bg-amber-600/20",
    border: "border-amber-500/30 hover:border-amber-500/50",
  },
};

const iconColors: Record<ModuleType, string> = {
  events: "text-blue-400",
  reservations: "text-purple-400",
  checkin: "text-emerald-400",
  admin: "text-amber-400",
};

export default function SelectModulePage() {
  const router = useRouter();
  const { user, isAuthenticated, setActiveModule, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // Leader kullanıcıları kendi paneline yönlendir
    if (user?.role === "leader") {
      router.push("/leader");
      return;
    }
  }, [isAuthenticated, user, router]);

  if (!user) return null;

  const handleSelectModule = (moduleId: ModuleType) => {
    setActiveModule(moduleId);
    router.push(MODULES[moduleId].path);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Kullanıcının erişebildiği modüller - admin modülü en sona
  const allowedModules = user.allowedModules
    .map((id) => MODULES[id])
    .sort((a, b) => {
      // Admin modülünü en sona koy
      if (a.adminOnly) return 1;
      if (b.adminOnly) return -1;
      return 0;
    });

  // Normal modüller ve admin modülü ayrımı
  const regularModules = allowedModules.filter((m) => !m.adminOnly);
  const adminModules = allowedModules.filter((m) => m.adminOnly);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Image
            src="/eventflowprologo.png"
            alt="EventFlow PRO"
            width={160}
            height={42}
            className="h-10 w-auto"
            priority
          />
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              Hoş geldin,{" "}
              <span className="text-white font-medium">{user.fullName}</span>
            </span>
            {user.role === "admin" && (
              <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Admin
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-2 text-white">Modül Seçin</h2>
            <p className="text-slate-400">
              Çalışmak istediğiniz modülü seçerek devam edin
            </p>
          </div>

          {/* Ana Modüller */}
          <div
            className={`grid gap-6 mb-8 ${
              regularModules.length === 3
                ? "md:grid-cols-3"
                : regularModules.length === 2
                ? "md:grid-cols-2 max-w-2xl mx-auto"
                : "max-w-md mx-auto"
            }`}
          >
            {regularModules.map((module) => {
              const Icon = iconMap[module.icon as keyof typeof iconMap];
              const colors = moduleColors[module.id];
              const iconColor = iconColors[module.id];

              return (
                <button
                  key={module.id}
                  onClick={() => handleSelectModule(module.id)}
                  className={`bg-gradient-to-br ${colors.gradient} p-8 rounded-2xl border ${colors.border} text-left transition-all group hover:scale-[1.02] active:scale-[0.98]`}
                >
                  <div
                    className={`w-16 h-16 ${colors.iconBg} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                  >
                    <Icon className={`w-8 h-8 ${iconColor}`} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-white">
                    {module.name}
                  </h3>
                  <p className="text-slate-400 text-sm">{module.description}</p>
                </button>
              );
            })}
          </div>

          {/* Admin Modülleri - Ayrı bölüm */}
          {adminModules.length > 0 && (
            <>
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-slate-900 text-slate-500 text-sm">
                    Yönetim Araçları
                  </span>
                </div>
              </div>

              <div className="max-w-md mx-auto">
                {adminModules.map((module) => {
                  const Icon = iconMap[module.icon as keyof typeof iconMap];
                  const colors = moduleColors[module.id];
                  const iconColor = iconColors[module.id];

                  return (
                    <button
                      key={module.id}
                      onClick={() => handleSelectModule(module.id)}
                      className={`w-full bg-gradient-to-br ${colors.gradient} p-6 rounded-2xl border ${colors.border} text-left transition-all group hover:scale-[1.02] active:scale-[0.98] flex items-center gap-6`}
                    >
                      <div
                        className={`w-14 h-14 ${colors.iconBg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}
                      >
                        <Icon className={`w-7 h-7 ${iconColor}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-1 text-white">
                          {module.name}
                        </h3>
                        <p className="text-slate-400 text-sm">
                          {module.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {allowedModules.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              Erişim izniniz olan modül bulunmuyor.
              <br />
              Lütfen yöneticinizle iletişime geçin.
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 text-center text-slate-500 text-sm">
        EventFlow PRO © 2025 - Tüm hakları saklıdır
      </footer>
    </div>
  );
}
