"use client";

import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/usePWA";
import { cn } from "@/lib/utils";

interface UpdatePromptProps {
  className?: string;
}

export function UpdatePrompt({ className }: UpdatePromptProps) {
  const { isUpdateAvailable, updateServiceWorker } = usePWA();

  if (!isUpdateAvailable) return null;

  const handleUpdate = () => {
    updateServiceWorker();
  };

  const handleDismiss = () => {
    // Just hide for this session - will show again on next visit
    // We don't persist this dismissal
  };

  return (
    <div
      className={cn(
        "fixed bottom-20 left-4 right-4 z-[99] max-w-md mx-auto",
        "animate-in slide-in-from-bottom duration-300",
        className
      )}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-green-500" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm">
              Güncelleme Mevcut
            </h3>
            <p className="text-slate-400 text-xs mt-1">
              Yeni bir sürüm hazır. Güncellemek için yenileyin.
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-white transition-colors"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action */}
        <div className="mt-3">
          <Button
            size="sm"
            onClick={handleUpdate}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Şimdi Güncelle
          </Button>
        </div>
      </div>
    </div>
  );
}

export default UpdatePrompt;
