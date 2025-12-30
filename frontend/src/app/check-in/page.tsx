"use client";

/**
 * Check-in Module - Ana Sayfa
 * Requirements: 10.1, 10.4
 */

import { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  Search,
  Clock,
  UserPlus,
  Calendar,
  ChevronDown,
  Volume2,
  VolumeX,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCheckInStore } from "@/store/check-in-store";
import { usePWA } from "@/hooks/usePWA";
import { EventSelectorModal } from "@/components/check-in/EventSelectorModal";
import { EventStatsDashboard } from "@/components/check-in/EventStatsDashboard";
import { QRScannerPanel } from "@/components/check-in/QRScannerPanel";
import { ManualSearchPanel } from "@/components/check-in/ManualSearchPanel";
import { CheckInHistoryPanel } from "@/components/check-in/CheckInHistoryPanel";
import { WalkInRegistrationPanel } from "@/components/check-in/WalkInRegistrationPanel";
import { OfflineIndicator } from "@/components/check-in/OfflineIndicator";
import { preloadSounds } from "@/lib/sound-feedback";
import {
  initOfflineQueueManager,
  cleanupOfflineQueueManager,
} from "@/lib/offline-check-in-queue";
import type { CheckInResult, CheckInError } from "@/store/check-in-store";

type TabType = "scanner" | "search" | "history" | "walkin";

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: "scanner", label: "Tarama", icon: <QrCode className="w-5 h-5" /> },
  { id: "search", label: "Ara", icon: <Search className="w-5 h-5" /> },
  { id: "history", label: "Geçmiş", icon: <Clock className="w-5 h-5" /> },
  { id: "walkin", label: "Walk-in", icon: <UserPlus className="w-5 h-5" /> },
];

export default function CheckInPage() {
  const [activeTab, setActiveTab] = useState<TabType>("scanner");
  const [showEventSelector, setShowEventSelector] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    selectedEventId,
    selectedEvent,
    eventStats,
    soundEnabled,
    toggleSound,
    selectEvent,
    clearEvent,
    isLoading,
    error,
    subscribeToUpdates,
    unsubscribeFromUpdates,
    setOnlineStatus,
  } = useCheckInStore();

  // PWA hook for online/offline status
  const { isOnline } = usePWA();

  // Sync online status with check-in store
  useEffect(() => {
    setOnlineStatus(isOnline);
  }, [isOnline, setOnlineStatus]);

  // Initialize on mount
  useEffect(() => {
    // Preload sounds
    preloadSounds();

    // Initialize offline queue manager
    initOfflineQueueManager();

    // If no event selected, show selector
    if (!selectedEventId) {
      setShowEventSelector(true);
    }

    setIsInitialized(true);

    return () => {
      cleanupOfflineQueueManager();
      unsubscribeFromUpdates();
    };
  }, [selectedEventId, unsubscribeFromUpdates]);

  // Subscribe to real-time updates when event is selected
  useEffect(() => {
    if (selectedEventId) {
      subscribeToUpdates(selectedEventId);
    }

    return () => {
      if (selectedEventId) {
        unsubscribeFromUpdates();
      }
    };
  }, [selectedEventId, subscribeToUpdates, unsubscribeFromUpdates]);

  // Handle event selection
  const handleEventSelect = useCallback(
    async (eventId: string) => {
      await selectEvent(eventId);
      setShowEventSelector(false);
    },
    [selectEvent]
  );

  // Handle check-in success
  const handleCheckInSuccess = useCallback((result: CheckInResult) => {
    console.log("[CheckIn] Success:", result);
    // Stats will be refreshed automatically by the store
  }, []);

  // Handle check-in error
  const handleCheckInError = useCallback((error: CheckInError) => {
    console.log("[CheckIn] Error:", error);
  }, []);

  // Render tab content
  const renderTabContent = () => {
    if (!selectedEventId) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-white font-medium mb-2">Etkinlik Seçilmedi</h3>
          <p className="text-slate-400 text-sm text-center mb-4">
            Check-in yapmak için bir etkinlik seçin
          </p>
          <Button onClick={() => setShowEventSelector(true)}>
            Etkinlik Seç
          </Button>
        </div>
      );
    }

    switch (activeTab) {
      case "scanner":
        return (
          <QRScannerPanel
            eventId={selectedEventId}
            onCheckInSuccess={handleCheckInSuccess}
            onCheckInError={handleCheckInError}
          />
        );
      case "search":
        return (
          <ManualSearchPanel
            eventId={selectedEventId}
            onCheckInSuccess={handleCheckInSuccess}
            onCheckInError={handleCheckInError}
          />
        );
      case "history":
        return <CheckInHistoryPanel />;
      case "walkin":
        return (
          <WalkInRegistrationPanel
            eventId={selectedEventId}
            onSuccess={handleCheckInSuccess}
            onError={handleCheckInError}
          />
        );
      default:
        return null;
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Back & Title */}
            <div className="flex items-center gap-3">
              <Link
                href="/select-module"
                className="p-2 -ml-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-white">Check-in</h1>
                <p className="text-xs text-slate-400">Giriş Kontrolü</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Offline Indicator */}
              <OfflineIndicator compact />

              {/* Sound Toggle */}
              <button
                onClick={toggleSound}
                className={`p-2 rounded-lg transition-colors ${
                  soundEnabled
                    ? "bg-blue-600/20 text-blue-400"
                    : "bg-slate-700 text-slate-400"
                }`}
                title={soundEnabled ? "Sesi Kapat" : "Sesi Aç"}
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Event Selector */}
          <button
            onClick={() => setShowEventSelector(true)}
            className="mt-3 w-full p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-400" />
              <div className="text-left">
                {selectedEvent ? (
                  <>
                    <div className="text-white font-medium line-clamp-1">
                      {selectedEvent.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(selectedEvent.eventDate).toLocaleDateString(
                        "tr-TR",
                        {
                          day: "numeric",
                          month: "long",
                        }
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400">Etkinlik seçin...</div>
                )}
              </div>
            </div>
            <ChevronDown className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Stats Dashboard (Compact) */}
        {selectedEventId && (
          <div className="px-4 pb-3">
            <EventStatsDashboard stats={eventStats} compact isRealtime />
          </div>
        )}
      </header>

      {/* Tab Navigation */}
      <nav className="bg-slate-800/50 border-b border-slate-700 sticky top-[140px] z-30">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 transition-colors ${
                activeTab === tab.id
                  ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/10"
                  : "text-slate-400 hover:text-slate-300 hover:bg-slate-700/50"
              }`}
            >
              {tab.icon}
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400">Yükleniyor...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-white font-medium mb-2">Hata</h3>
            <p className="text-red-400 text-sm text-center mb-4">{error}</p>
            <Button
              variant="outline"
              onClick={() => selectedEventId && selectEvent(selectedEventId)}
            >
              Tekrar Dene
            </Button>
          </div>
        ) : (
          renderTabContent()
        )}
      </main>

      {/* Full Stats (Bottom Sheet style on mobile) */}
      {selectedEventId && eventStats && (
        <div className="bg-slate-800 border-t border-slate-700 p-4 lg:hidden">
          <EventStatsDashboard
            stats={eventStats}
            eventName={selectedEvent?.name}
            isRealtime
          />
        </div>
      )}

      {/* Event Selector Modal */}
      <EventSelectorModal
        isOpen={showEventSelector}
        onClose={() => setShowEventSelector(false)}
        onSelect={handleEventSelect}
        currentEventId={selectedEventId}
      />
    </div>
  );
}
