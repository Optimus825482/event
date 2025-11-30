"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Users,
  MapPin,
  LayoutDashboard,
  ChevronDown,
  LogOut,
  Settings,
  LayoutGrid,
  User,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, MODULES } from "@/store/auth-store";
import { NotificationCenter } from "@/components/ui/NotificationCenter";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

// Etkinlik Planlama modülü menü öğeleri
const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Etkinlikler",
    url: "/events",
    icon: Calendar,
  },
  {
    title: "Ekip Organizasyonu",
    url: "/staff",
    icon: Users,
  },
  {
    title: "Alan Şablonları",
    url: "/venues",
    icon: MapPin,
  },
];

interface EventPlanningLayoutProps {
  children: React.ReactNode;
}

export function EventPlanningLayout({ children }: EventPlanningLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, clearActiveModule } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleSwitchModule = () => {
    clearActiveModule();
    router.push("/select-module");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-900">
        {/* Sidebar */}
        <Sidebar className="border-r border-slate-800">
          <SidebarHeader className="border-b border-slate-800 p-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  EventFlow PRO
                </span>
                <span className="text-[10px] text-slate-500">
                  Etkinlik Planlama
                </span>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-slate-500 text-xs uppercase tracking-wider">
                Ana Menü
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => {
                    const isActive =
                      pathname === item.url ||
                      (item.url !== "/dashboard" &&
                        pathname.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "transition-colors",
                            isActive
                              ? "bg-blue-600/20 text-blue-400 border-l-2 border-blue-500"
                              : "text-slate-400"
                          )}
                        >
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="bg-slate-800" />

            <SidebarGroup>
              <SidebarGroupLabel className="text-slate-500 text-xs uppercase tracking-wider">
                Hızlı Erişim
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild className="text-slate-400">
                      <Link href="/settings">
                        <Settings className="h-4 w-4" />
                        <span>Ayarlar</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-800 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 px-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      {user?.fullName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium text-white">
                      {user?.fullName}
                    </span>
                    <span className="text-xs text-slate-500">
                      @{user?.username}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto h-4 w-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 bg-slate-800 border-slate-700"
              >
                <DropdownMenuItem
                  onClick={handleSwitchModule}
                  className="cursor-pointer"
                >
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  Modül Değiştir
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Ayarlar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-400 focus:text-red-400"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Ana İçerik */}
        <div className="flex-1 flex flex-col">
          {/* Üst Bar */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur px-6">
            <SidebarTrigger className="text-slate-400" />

            <div className="flex-1" />

            {/* Bildirimler */}
            <NotificationCenter />

            {/* Mobil Profil */}
            <div className="md:hidden">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-600 text-white text-xs">
                  {user?.fullName?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

          {/* Sayfa İçeriği */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
