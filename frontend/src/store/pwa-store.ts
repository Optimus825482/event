import { create } from "zustand";
import { persist } from "zustand/middleware";

// BeforeInstallPromptEvent type definition
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAStore {
  // State
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallBannerVisible: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  lastDismissed: number | null;
  pendingSyncCount: number;

  // Actions
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  showInstallBanner: () => void;
  hideInstallBanner: () => void;
  setInstalled: (installed: boolean) => void;
  setOnline: (online: boolean) => void;
  setUpdateAvailable: (available: boolean) => void;
  dismissBanner: () => void;
  setPendingSyncCount: (count: number) => void;
  incrementPendingSync: () => void;
  decrementPendingSync: () => void;
  canShowInstallBanner: () => boolean;
}

const DISMISS_COOLDOWN_DAYS = 7;
const DISMISS_COOLDOWN_MS = DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export const usePWAStore = create<PWAStore>()(
  persist(
    (set, get) => ({
      // Initial state
      deferredPrompt: null,
      isInstallBannerVisible: false,
      isInstalled: false,
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      isUpdateAvailable: false,
      lastDismissed: null,
      pendingSyncCount: 0,

      // Actions
      setDeferredPrompt: (prompt) => set({ deferredPrompt: prompt }),

      showInstallBanner: () => {
        const state = get();
        if (state.canShowInstallBanner()) {
          set({ isInstallBannerVisible: true });
        }
      },

      hideInstallBanner: () => set({ isInstallBannerVisible: false }),

      setInstalled: (installed) =>
        set({
          isInstalled: installed,
          isInstallBannerVisible: installed
            ? false
            : get().isInstallBannerVisible,
        }),

      setOnline: (online) => set({ isOnline: online }),

      setUpdateAvailable: (available) => set({ isUpdateAvailable: available }),

      dismissBanner: () =>
        set({
          isInstallBannerVisible: false,
          lastDismissed: Date.now(),
        }),

      setPendingSyncCount: (count) => set({ pendingSyncCount: count }),

      incrementPendingSync: () =>
        set((state) => ({ pendingSyncCount: state.pendingSyncCount + 1 })),

      decrementPendingSync: () =>
        set((state) => ({
          pendingSyncCount: Math.max(0, state.pendingSyncCount - 1),
        })),

      canShowInstallBanner: () => {
        const state = get();

        // Don't show if already installed
        if (state.isInstalled) return false;

        // Don't show if no install prompt available
        if (!state.deferredPrompt) return false;

        // Don't show if dismissed recently
        if (state.lastDismissed) {
          const timeSinceDismiss = Date.now() - state.lastDismissed;
          if (timeSinceDismiss < DISMISS_COOLDOWN_MS) return false;
        }

        return true;
      },
    }),
    {
      name: "pwa-storage",
      partialize: (state) => ({
        isInstalled: state.isInstalled,
        lastDismissed: state.lastDismissed,
      }),
    }
  )
);

// Export type for BeforeInstallPromptEvent
export type { BeforeInstallPromptEvent };
