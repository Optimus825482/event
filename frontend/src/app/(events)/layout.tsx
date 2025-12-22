"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Navbar } from "@/components/ui/Navbar";
import { ToastProvider } from "@/components/ui/toast-notification";

export default function EventsModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, activeModule } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydration tamamlanana kadar bekle
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // Hydration tamamlanmadan kontrol yapma
    if (!isHydrated) return;

    // Auth kontrolü
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // Modül kontrolü
    if (!activeModule) {
      router.push("/select-module");
      return;
    }

    // Events modülü değilse yönlendir
    if (activeModule !== "events") {
      router.push("/select-module");
    }
  }, [isHydrated, isAuthenticated, activeModule, router]);

  // Hydration veya auth beklerken loading göster
  if (!isHydrated || !isAuthenticated || activeModule !== "events") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <Navbar />
      {children}
    </ToastProvider>
  );
}
