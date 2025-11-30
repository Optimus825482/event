"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Calendar, Ticket, QrCode, LogOut } from "lucide-react";
import { useAuthStore, MODULES, ModuleType } from "@/store/auth-store";

const iconMap = {
  Calendar,
  Ticket,
  QrCode,
};

export default function SelectModulePage() {
  const router = useRouter();
  const { user, isAuthenticated, setActiveModule, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

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
  const allowedModules = user.allowedModules.map((id) => MODULES[id]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
              Hoş geldin, <span className="text-white">{user.fullName}</span>
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-slate-400 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-2">Modül Seçin</h2>
            <p className="text-slate-400">
              Çalışmak istediğiniz modülü seçerek devam edin
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {allowedModules.map((module) => {
              const Icon = iconMap[module.icon as keyof typeof iconMap];

              return (
                <button
                  key={module.id}
                  onClick={() => handleSelectModule(module.id)}
                  className="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-left transition-all group"
                >
                  <div className="w-16 h-16 bg-blue-600/20 rounded-xl flex items-center justify-center mb-6 group-active:scale-95 transition-transform">
                    <Icon className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{module.name}</h3>
                  <p className="text-slate-400 text-sm">{module.description}</p>
                </button>
              );
            })}
          </div>

          {allowedModules.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              Erişim izniniz olan modül bulunmuyor.
              <br />
              Lütfen yöneticinizle iletişime geçin.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
