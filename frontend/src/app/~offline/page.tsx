"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/eventflowprologo.png"
            alt="EventFlow PRO"
            width={180}
            height={60}
            className="h-12 w-auto"
            priority
          />
        </div>

        {/* Offline Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-slate-400" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-white">Çevrimdışı</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            İnternet bağlantınız yok gibi görünüyor. Lütfen bağlantınızı kontrol
            edin ve tekrar deneyin.
          </p>
        </div>

        {/* Tips */}
        <div className="bg-slate-800/50 rounded-lg p-4 text-left space-y-2">
          <p className="text-slate-300 text-sm font-medium">
            Kontrol edilecekler:
          </p>
          <ul className="text-slate-400 text-sm space-y-1 list-disc list-inside">
            <li>Wi-Fi veya mobil veri bağlantınız</li>
            <li>Uçak modu kapalı mı?</li>
            <li>Router veya modem çalışıyor mu?</li>
          </ul>
        </div>

        {/* Retry Button */}
        <Button
          onClick={handleRetry}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Tekrar Dene
        </Button>

        {/* Footer */}
        <p className="text-slate-500 text-xs">
          Bağlantı sağlandığında sayfa otomatik olarak yenilenecektir.
        </p>
      </div>
    </div>
  );
}
