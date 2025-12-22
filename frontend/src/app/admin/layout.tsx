"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Navbar } from "@/components/ui/Navbar";
import { ToastProvider } from "@/components/ui/toast-notification";

export default function AdminModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, activeModule, user } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!activeModule) {
      router.push("/select-module");
      return;
    }

    // Admin modülü değilse veya admin rolü yoksa yönlendir
    if (activeModule !== "admin") {
      router.push("/select-module");
      return;
    }

    if (user?.role !== "admin") {
      router.push("/select-module");
      return;
    }
  }, [isHydrated, isAuthenticated, activeModule, user, router]);

  if (
    !isHydrated ||
    !isAuthenticated ||
    activeModule !== "admin" ||
    user?.role !== "admin"
  ) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
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
