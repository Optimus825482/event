"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  Ticket,
  QrCode,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  MapPin,
  LayoutGrid,
  User,
  ChevronDown,
  LayoutDashboard,
  UserCog,
  ChevronRight,
  Bell,
} from "lucide-react";
import { useState, useMemo } from "react";
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
  {
    id: "admin",
    label: "Sistem",
    icon: Shield,
    gradient: "from-amber-500/20 to-amber-600/20",
    activeGradient: "from-amber-500 to-amber-600",
  },
];

// Modül bazlı menü yapılandırması
const moduleMenus: Record<
  ModuleType,
  { href: string; label: string; icon: any }[]
> = {
  events: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/events", label: "Etkinlikler", icon: Calendar },
    { href: "/staff", label: "Ekipler", icon: Users },
    { href: "/templates", label: "Şablonlar", icon: LayoutGrid },
  ],
  reservations: [
    { href: "/reservations", label: "Etkinlik Seç", icon: Calendar },
    { href: "/guests", label: "Misafirler", icon: Users },
  ],
  checkin: [{ href: "/check-in", label: "QR Okuyucu", icon: QrCode }],
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Kullanıcılar", icon: UserCog },
    { href: "/admin/notifications", label: "Bildirimler", icon: Bell },
    { href: "/admin/settings", label: "Sistem Ayarları", icon: Settings },
  ],
  leader: [
    { href: "/leader", label: "Dashboard", icon: LayoutDashboard },
    { href: "/leader/events", label: "Etkinlikler", icon: Calendar },
    { href: "/leader/team", label: "Ekip", icon: Users },
    { href: "/leader/reviews", label: "Değerlendirmeler", icon: Settings },
  ],
};

// Breadcrumb route tanımları
const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  events: "Etkinlikler",
  venues: "Alan Şablonları",
  staff: "Ekipler",
  templates: "Şablonlar",
  reservations: "Rezervasyonlar",
  guests: "Misafirler",
  "check-in": "Check-in",
  admin: "Yönetim",
  users: "Kullanıcılar",
  settings: "Ayarlar",
  new: "Yeni",
  edit: "Düzenle",
  venue: "Alan Planı",
  "team-organization": "Ekip Organizasyonu",
};

// Modül renkleri
const moduleColors: Record<
  ModuleType,
  { text: string; bg: string; border: string }
> = {
  events: {
    text: "text-blue-400",
    bg: "bg-blue-600",
    border: "border-blue-500",
  },
  reservations: {
    text: "text-purple-400",
    bg: "bg-purple-600",
    border: "border-purple-500",
  },
  checkin: {
    text: "text-emerald-400",
    bg: "bg-emerald-600",
    border: "border-emerald-500",
  },
  admin: {
    text: "text-amber-400",
    bg: "bg-amber-600",
    border: "border-amber-500",
  },
  leader: {
    text: "text-cyan-400",
    bg: "bg-cyan-600",
    border: "border-cyan-500",
  },
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

  // Breadcrumb oluştur
  const breadcrumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const crumbs: { label: string; href: string; isLast: boolean }[] = [];

    let currentPath = "";
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // UUID veya ID kontrolü
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          segment
        );
      const isNumericId = /^\d+$/.test(segment);

      if (isUUID || isNumericId) {
        // UUID/ID'leri breadcrumb'dan atla - etkinlik detay sayfası kendi başlığını gösterir
        // Sadece son segment değilse atla (yani /events/[id]/venue gibi durumlarda)
        if (index !== segments.length - 1) {
          return; // Bu segmenti atla
        }
        // Son segment ise "Detay" göster
        crumbs.push({
          label: "Detay",
          href: currentPath,
          isLast: true,
        });
      } else {
        const label =
          ROUTE_LABELS[segment] ||
          segment.charAt(0).toUpperCase() + segment.slice(1);
        crumbs.push({
          label,
          href: currentPath,
          isLast: index === segments.length - 1,
        });
      }
    });

    return crumbs;
  }, [pathname]);

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
  const colors = moduleColors[activeModule];

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
      : activeModule === "admin"
      ? Shield
      : QrCode;

  // Kullanıcının erişebildiği modüller
  const userModules = MODULE_STRIP_CONFIG.filter((m) =>
    user?.allowedModules.includes(m.id)
  );

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        {/* Üst Satır - Logo + Menü + Profil */}
        <div className="flex items-center justify-between h-14 border-b border-slate-800">
          {/* Logo */}
          <Link href={currentModuleInfo.path} className="flex items-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              EventFlow PRO
            </h1>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  item.href !== "/admin" &&
                  pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? `${colors.bg} text-white`
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right Side - Bildirimler + Profil */}
          <div className="hidden md:flex items-center gap-3">
            {/* Bildirim Merkezi */}
            <NotificationCenter />

            {/* Profil Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <div
                  className={`w-8 h-8 ${colors.bg} rounded-full flex items-center justify-center`}
                >
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-white hidden lg:block">
                  {user?.fullName}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {/* Profil Dropdown Menu */}
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 rounded-lg border border-slate-700 shadow-xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-700">
                    <p className="font-medium text-white">{user?.fullName}</p>
                    <p className="text-sm text-slate-400">@{user?.username}</p>
                    {user?.role === "admin" && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Admin
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleSwitchModule}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-slate-300 hover:bg-slate-700 transition-colors text-sm"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Sistem Girişi
                  </button>

                  {/* Admin için Kullanıcı Yönetimi - Tüm modüllerde görünür */}
                  {user?.role === "admin" && (
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        router.push("/admin/users");
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-amber-400 hover:bg-slate-700 transition-colors text-sm"
                    >
                      <UserCog className="w-4 h-4" />
                      Kullanıcı Yönetimi
                    </button>
                  )}

                  {/* Modüller - Sadece birden fazla modül varsa */}
                  {userModules.length > 1 && (
                    <div className="px-3 py-2 border-t border-slate-700">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 px-1">
                        Modüller
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {userModules.map((module) => {
                          const isActive = activeModule === module.id;
                          const Icon = module.icon;
                          return (
                            <button
                              key={module.id}
                              onClick={() => {
                                const targetPath = MODULES[module.id].path;
                                setActiveModule(module.id);
                                setProfileMenuOpen(false);
                                setTimeout(() => {
                                  router.push(targetPath);
                                }, 50);
                              }}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all",
                                isActive
                                  ? `bg-gradient-to-r ${module.activeGradient} text-white`
                                  : "text-slate-400 hover:text-white hover:bg-slate-700"
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {module.label}
                              {isActive && (
                                <span className="ml-auto text-[10px] opacity-70">
                                  ●
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-700 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-red-400 hover:bg-slate-700 transition-colors text-sm"
                    >
                      <LogOut className="w-4 h-4" />
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
            className="md:hidden p-2 text-slate-400 hover:text-white"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Alt Satır - Breadcrumb */}
        <div className="hidden md:flex items-center gap-2 h-10">
          {/* Modül Badge */}
          <Link
            href={currentModuleInfo.path}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg}/20 border ${colors.border}/30 hover:${colors.bg}/30 transition-colors`}
          >
            <ModuleIcon className={`w-3.5 h-3.5 ${colors.text}`} />
            <span className={`text-xs font-medium ${colors.text}`}>
              {currentModuleInfo.name}
            </span>
          </Link>

          {/* Breadcrumb Items - Her zaman göster */}
          {breadcrumbs.length > 0 && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-600" />
              {breadcrumbs.map((crumb) => {
                // Breadcrumb için ikon bul
                const menuItem = menuItems.find(
                  (item) => item.href === crumb.href
                );
                const CrumbIcon = menuItem?.icon;

                return (
                  <div key={crumb.href} className="flex items-center gap-2">
                    {crumb.isLast ? (
                      <span
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg}/30 border ${colors.border}/40 text-xs ${colors.text} font-medium`}
                      >
                        {CrumbIcon && <CrumbIcon className="w-3 h-3" />}
                        {crumb.label}
                      </span>
                    ) : (
                      <>
                        <Link
                          href={crumb.href}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg}/10 border ${colors.border}/20 text-xs text-slate-400 hover:${colors.text} hover:${colors.bg}/20 transition-colors`}
                        >
                          {CrumbIcon && <CrumbIcon className="w-3 h-3" />}
                          {crumb.label}
                        </Link>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            {/* Modül Bilgisi */}
            <div
              className={`flex items-center gap-2 px-4 py-2 mb-4 ${colors.bg}/20 rounded-lg mx-4 border ${colors.border}/30`}
            >
              <ModuleIcon className={`w-5 h-5 ${colors.text}`} />
              <span className={`font-medium ${colors.text}`}>
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
                      isActive ? `${colors.bg} text-white` : "text-slate-400"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Modül Değiştir - Mobil */}
            {userModules.length > 1 && (
              <div className="px-4 mb-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-4">
                  Modül Değiştir
                </p>
                <div className="flex flex-wrap gap-2 px-4">
                  {userModules.map((module) => {
                    const isActive = activeModule === module.id;
                    const Icon = module.icon;
                    return (
                      <button
                        key={module.id}
                        onClick={() => {
                          setActiveModule(module.id);
                          router.push(MODULES[module.id].path);
                          setMobileMenuOpen(false);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                          isActive
                            ? `bg-gradient-to-r ${module.activeGradient} text-white`
                            : "bg-slate-800 text-slate-400"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {module.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Alt Menü */}
            <div className="border-t border-slate-800 pt-4 mx-4">
              <button
                onClick={handleSwitchModule}
                className="flex items-center gap-3 px-4 py-3 text-slate-300 w-full rounded-lg hover:bg-slate-800"
              >
                <LayoutGrid className="w-5 h-5" />
                Modül Seçimine Dön
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 text-red-400 w-full rounded-lg hover:bg-slate-800"
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
