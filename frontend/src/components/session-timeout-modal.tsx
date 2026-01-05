"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, X } from "lucide-react";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";

export function SessionTimeoutModal() {
  const { showWarning, remainingTime, extendSession, dismissWarning } =
    useSessionTimeout({ warningTime: 2 * 60 * 1000 }); // 2 dakika önce uyar

  const [extending, setExtending] = useState(false);

  const handleExtend = async () => {
    setExtending(true);
    try {
      await extendSession();
    } finally {
      setExtending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md mx-4 overflow-hidden">
        {/* Close button */}
        <button
          onClick={dismissWarning}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors z-10"
          aria-label="Kapat"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <Clock className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Oturum Süresi Doluyor</h2>
          </div>

          <p className="text-slate-300 text-sm">
            Oturumunuz{" "}
            <span className="font-bold text-amber-400">
              {formatTime(remainingTime)}
            </span>{" "}
            içinde sona erecek. Devam etmek için oturumu uzatın.
          </p>

          {/* Timer */}
          <div className="flex items-center justify-center py-8">
            <div className="text-6xl font-mono font-bold text-amber-500 tracking-wider">
              {formatTime(remainingTime)}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={dismissWarning}
              className="flex items-center gap-2 border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <LogOut className="w-4 h-4" />
              Çıkış Yap
            </Button>
            <Button
              type="button"
              onClick={handleExtend}
              disabled={extending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6"
            >
              {extending ? "Uzatılıyor..." : "Oturumu Uzat"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
