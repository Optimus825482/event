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
  const { isAuthenticated, activeModule } = useAuthStore();
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
    if (activeModule !== "checkin") {
      router.push("/select-module");
    }
  }, [isHydrated, isAuthenticated, activeModule, router]);

  if (!isHydrated || !isAuthenticated || activeModule !== "checkin") {
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
