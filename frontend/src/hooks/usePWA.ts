"use client";

import { useEffect, useCallback } from "react";
import { usePWAStore, BeforeInstallPromptEvent } from "@/store/pwa-store";

interface UsePWAReturn {
  // State
  isInstalled: boolean;
  isOnline: boolean;
  canInstall: boolean;
  isUpdateAvailable: boolean;
  isInstallBannerVisible: boolean;
  pendingSyncCount: number;

  // Actions
  promptInstall: () => Promise<boolean>;
  dismissInstallPrompt: () => void;
  updateServiceWorker: () => void;
  showInstallBanner: () => void;
}

export function usePWA(): UsePWAReturn {
  const {
    deferredPrompt,
    isInstalled,
    isOnline,
    isUpdateAvailable,
    isInstallBannerVisible,
    pendingSyncCount,
    setDeferredPrompt,
    setInstalled,
    setOnline,
    setUpdateAvailable,
    showInstallBanner,
    dismissBanner,
    canShowInstallBanner,
  } = usePWAStore();

  // Handle beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show install banner after a delay (user has interacted with app)
      setTimeout(() => {
        showInstallBanner();
      }, 30000); // 30 seconds delay
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Check if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [setDeferredPrompt, setInstalled, showInstallBanner]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Set initial state
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);

  // Handle service worker updates
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New content is available
                setUpdateAvailable(true);
              }
            });
          }
        });
      });

      // Listen for controller change (new SW activated)
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, [setUpdateAvailable]);

  // Prompt install
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setInstalled(true);
        setDeferredPrompt(null);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Install prompt error:", error);
      return false;
    }
  }, [deferredPrompt, setInstalled, setDeferredPrompt]);

  // Dismiss install prompt
  const dismissInstallPrompt = useCallback(() => {
    dismissBanner();
  }, [dismissBanner]);

  // Update service worker
  const updateServiceWorker = useCallback(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      });
    }
  }, []);

  return {
    isInstalled,
    isOnline,
    canInstall: canShowInstallBanner(),
    isUpdateAvailable,
    isInstallBannerVisible,
    pendingSyncCount,
    promptInstall,
    dismissInstallPrompt,
    updateServiceWorker,
    showInstallBanner,
  };
}

export default usePWA;
