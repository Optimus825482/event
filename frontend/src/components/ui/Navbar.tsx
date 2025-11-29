'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore, MODULES, ModuleType } from '@/store/auth-store';
import { NotificationCenter } from './NotificationCenter';

// Modül bazlı menü yapılandırması
const moduleMenus: Record<ModuleType, { href: string; label: string; icon: any }[]> = {
  events: [
    { href: '/events', label: 'Etkinlikler', icon: Calendar },
    { href: '/events/new', label: 'Yeni Etkinlik', icon: Calendar },
    { href: '/customers', label: 'Müşteriler', icon: Users },
    { href: '/venues', label: 'Mekanlar', icon: MapPin },
  ],
  reservations: [
    { href: '/reservations', label: 'Rezervasyonlar', icon: Ticket },
    { href: '/reservations/new', label: 'Yeni Rezervasyon', icon: Ticket },
    { href: '/customers', label: 'Müşteriler', icon: Users },
  ],
  checkin: [
    { href: '/check-in', label: 'QR Okuyucu', icon: QrCode },
    { href: '/dashboard', label: 'Canlı Dashboard', icon: LayoutGrid },
  ],
};

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeModule, isAuthenticated, logout, clearActiveModule } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Login/register/select-module sayfalarında navbar gösterme
  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/select-module' ||
    !isAuthenticated ||
    !activeModule
  ) {
    return null;
  }

  const currentModuleInfo = MODULES[activeModule];
  const menuItems = moduleMenus[activeModule] || [];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleSwitchModule = () => {
    clearActiveModule();
    router.push('/select-module');
  };

  // Modül ikonu
  const ModuleIcon =
    activeModule === 'events'
      ? Calendar
      : activeModule === 'reservations'
        ? Ticket
        : QrCode;

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Modül Adı */}
          <div className="flex items-center gap-4">
            <Link href={currentModuleInfo.path} className="flex items-center gap-2">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                EventFlow
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-blue-600/20 rounded-lg">
              <ModuleIcon className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">{currentModuleInfo.name}</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors',
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-400'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
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

                  <Link
                    href="/settings"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-slate-300"
                  >
                    <Settings className="w-5 h-5" />
                    Ayarlar
                  </Link>

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
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            {/* Modül Bilgisi */}
            <div className="flex items-center gap-2 px-4 py-2 mb-4 bg-blue-600/20 rounded-lg mx-4">
              <ModuleIcon className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-blue-400">{currentModuleInfo.name}</span>
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
                      'flex items-center gap-3 px-4 py-3 rounded-lg mx-4',
                      isActive ? 'bg-slate-800 text-white' : 'text-slate-400'
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
        <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
      )}
    </nav>
  );
}
