"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Navbar } from "@/components/ui/Navbar";

export default function CheckInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, activeModule, user } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  // Controller rolü için activeModule kontrolü bypass edilir
  const isController = user?.role === "controller";

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    // Controller için activeModule kontrolü yapma - direkt erişim izni var
    if (isController) return;

    if (!activeModule) {
      router.replace("/select-module");
      return;
    }
    if (activeModule !== "checkin") {
      router.replace("/select-module");
    }
  }, [isHydrated, isAuthenticated, activeModule, isController, router]);

  // Controller için veya activeModule checkin ise içeriği göster
  const canAccess = isController || activeModule === "checkin";

  if (!isHydrated || !isAuthenticated || !canAccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
