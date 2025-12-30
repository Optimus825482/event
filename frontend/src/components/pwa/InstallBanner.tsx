"use client";

import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/usePWA";
import { cn } from "@/lib/utils";

interface InstallBannerProps {
  className?: string;
}

export function InstallBanner({ className }: InstallBannerProps) {
  const { isInstallBannerVisible, promptInstall, dismissInstallPrompt } =
    usePWA();

  if (!isInstallBannerVisible) return null;

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      // Installation successful
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[100] p-4 bg-slate-800 border-t border-slate-700 shadow-lg",
        "animate-in slide-in-from-bottom duration-300",
        className
      )}
    >
      <div className="max-w-lg mx-auto">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm">
              EventFlow PRO&apos;yu Yükle
            </h3>
            <p className="text-slate-400 text-xs mt-1">
              Ana ekranınıza ekleyin, daha hızlı erişin ve çevrimdışı kullanın.
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={dismissInstallPrompt}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-white transition-colors"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={dismissInstallPrompt}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Şimdi Değil
          </Button>
          <Button
            size="sm"
            onClick={handleInstall}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Yükle
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InstallBanner;
