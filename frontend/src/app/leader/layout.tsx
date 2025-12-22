"use client";

import { ToastProvider } from "@/components/ui/toast-notification";

export default function LeaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ToastProvider>{children}</ToastProvider>;
}
