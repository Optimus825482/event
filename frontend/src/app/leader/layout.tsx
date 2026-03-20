"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LeaderNavbar } from "@/components/layout/LeaderNavbar";
import { useAuthStore } from "@/store/auth-store";
import { ToastProvider } from "@/components/ui/toast-notification";
import { Loader2 } from "lucide-react";

export default function LeaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (user.role !== "leader") {
      router.push("/select-module");
      return;
    }

    setIsAuthorized(true);
  }, [isHydrated, user, router]);

  // Loading state
  if (!isHydrated || !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-slate-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-900">
        <LeaderNavbar />
        <main>{children}</main>
      </div>
    </ToastProvider>
  );
}
