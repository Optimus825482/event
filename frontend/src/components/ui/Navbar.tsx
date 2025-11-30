"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  Ticket,
  QrCode,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  MapPin,
  LayoutGrid,
  User,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore, MODULES, ModuleType } from "@/store/auth-store";
import { NotificationCenter } from "./NotificationCenter";

// Modül şeridi için yapılandırma
const MODULE_STRIP_CONFIG: {
  id: ModuleType;
  label: string;
  icon: typeof Calendar;
  gradient: string;
  activeGradient: string;
}[] = [
  {
    id: "events",
    label: "Etkinlik Planlama",
    icon: Calendar,
    gradient: "from-blue-500/20 to-blue-600/20",
    activeGradient: "from-blue-500 to-blue-600",
  },
  {
    id: "reservations",
    label: "Rezervasyon",
    icon: Ticket,
    gradient: "from-purple-500/20 to-purple-600/20",
    activeGradient: "from-purple-500 to-purple-600",
  },
  {
    id: "checkin",
    label: "Check-in",
    icon: QrCode,
    gradient: "from-emerald-500/20 to-emerald-600/20",
    activeGradient: "from-emerald-500 to-emerald-600",
  },
];

// Modül bazlı menü yapılandırması
const moduleMenus: Record<
  ModuleType,
  { href: string; label: string; icon: any }[]
> = {
  events: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
    { href: "/events", label: "Etkinlikler", icon: Calendar },
    { href: "/staff", label: "Ekip Organizasyonu", icon: Users },
    { href: "/venues", label: "Alan Şablonları", icon: MapPin },
    { href: "/settings", label: "Ayarlar", icon: Settings },
  ],
  reservations: [
    { href: "/reservations", label: "Etkinlik Seç", icon: Calendar },
    { href: "/guests", label: "Misafirler", icon: Users },
  ],
  checkin: [
    { href: "/check-in", label: "QR Okuyucu", icon: QrCode },
    { href: "/dashboard", label: "Canlı Dashboard", icon: LayoutGrid },
  ],
};

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    activeModule,
    isAuthenticated,
    logout,
    clearActiveModule,
    setActiveModule,
  } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Login/register/select-module sayfalarında navbar gösterme
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/select-module" ||
    !isAuthenticated ||
    !activeModule
  ) {
    return null;
  }

  const currentModuleInfo = MODULES[activeModule];
  const menuItems = moduleMenus[activeModule] || [];

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleSwitchModule = () => {
    clearActiveModule();
    router.push("/select-module");
  };

  // Modül ikonu
  const ModuleIcon =
    activeModule === "events"
      ? Calendar
      : activeModule === "reservations"
      ? Ticket
      : QrCode;

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <Link
              href={currentModuleInfo.path}
              className="flex items-center gap-2"
            >
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                EventFlow PRO
              </h1>
            </Link>
          </div>

          {/* Desktop Nav + Module Strip */}
          <div className="hidden md:flex flex-col items-center">
            {/* Menü Öğeleri */}
            <div className="flex items-center gap-1">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors",
                      isActive ? "bg-slate-800 text-white" : "text-slate-400"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Admin/Organizer Module Strip - Menü altında */}
            {(user?.role === "admin" || user?.role === "organizer") && (
              <div className="flex items-center gap-0.5 mt-1 bg-slate-800/50 rounded-lg p-0.5">
                {MODULE_STRIP_CONFIG.map((module) => {
                  const isActive = activeModule === module.id;
                  const Icon = module.icon;

                  return (
                    <button
                      key={module.id}
                      onClick={() => {
                        const targetPath = MODULES[module.id].path;
                        setActiveModule(module.id);
                        setTimeout(() => {
                          router.push(targetPath);
                        }, 50);
                      }}
                      className={cn(
                        "relative flex items-center gap-1.5 py-1 px-3 rounded-md transition-all duration-300 text-xs font-medium",
                        isActive
                          ? `bg-gradient-to-r ${module.activeGradient} text-white shadow-sm`
                          : "text-slate-400"
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{module.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Side - Bildirimler + Profil */}
          <div className="hidden md:flex items-center gap-2">
            {/* Bildirim Merkezi */}
            <NotificationCenter />

            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <span className="text-sm">{user?.fullName}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {/* Profil Dropdown */}
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 rounded-lg border border-slate-700 shadow-xl py-2">
                  <div className="px-4 py-2 border-b border-slate-700">
                    <p className="font-medium">{user?.fullName}</p>
                    <p className="text-sm text-slate-400">@{user?.username}</p>
                  </div>

                  <button
                    onClick={handleSwitchModule}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-300"
                  >
                    <LayoutGrid className="w-5 h-5" />
                    Modül Değiştir
                  </button>

                  <div className="border-t border-slate-700 mt-2 pt-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-400"
                    >
                      <LogOut className="w-5 h-5" />
                      Çıkış Yap
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            {/* Modül Bilgisi */}
            <div className="flex items-center gap-2 px-4 py-2 mb-4 bg-blue-600/20 rounded-lg mx-4">
              <ModuleIcon className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-blue-400">
                {currentModuleInfo.name}
              </span>
            </div>

            {/* Menü */}
            <div className="flex flex-col gap-1 mb-4">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg mx-4",
                      isActive ? "bg-slate-800 text-white" : "text-slate-400"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Alt Menü */}
            <div className="border-t border-slate-800 pt-4">
              <button
                onClick={handleSwitchModule}
                className="flex items-center gap-3 px-4 py-3 text-slate-300 w-full"
              >
                <LayoutGrid className="w-5 h-5" />
                Modül Değiştir
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 text-red-400 w-full"
              >
                <LogOut className="w-5 h-5" />
                Çıkış Yap
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Overlay for profile menu */}
      {profileMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setProfileMenuOpen(false)}
        />
      )}
    </nav>
  );
}
