"use client";

/**
 * Manual Search Panel - İsim/telefon ile arama
 * Requirements: 4.1, 4.2, 4.3
 */

import { useState, useCallback, useEffect } from "react";
import { Search, User, Phone, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { GuestCard } from "./GuestCard";
import { TableLocatorModal } from "./TableLocatorModal";
import { useCheckInStore } from "@/store/check-in-store";
import { playSound } from "@/lib/sound-feedback";
import type {
  Reservation,
  CheckInResult,
  CheckInError,
  TableLocation,
} from "@/store/check-in-store";

interface ManualSearchPanelProps {
  eventId: string;
  onCheckInSuccess?: (result: CheckInResult) => void;
  onCheckInError?: (error: CheckInError) => void;
}

export function ManualSearchPanel({
  eventId,
  onCheckInSuccess,
  onCheckInError,
}: ManualSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Reservation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showTableLocator, setShowTableLocator] = useState(false);
  const [lastCheckInResult, setLastCheckInResult] =
    useState<CheckInResult | null>(null);

  const { searchReservations, checkIn, selectedEvent, soundEnabled } =
    useCheckInStore();

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const searchResults = await searchReservations(query);
        setResults(searchResults);
      } catch (error) {
        console.error("[ManualSearch] Search error:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchReservations]);

  const handleCheckIn = useCallback(
    async (reservation: Reservation) => {
      setIsCheckingIn(true);
      setSelectedReservation(reservation);

      try {
        const result = await checkIn(reservation.qrCodeHash);

        if ("code" in result) {
          const error = result as CheckInError;
          if (soundEnabled) {
            playSound(
              error.code === "ALREADY_CHECKED_IN" ? "warning" : "error"
            );
          }
          onCheckInError?.(error);
          setIsCheckingIn(false);
          return;
        }

        const successResult = result as CheckInResult;
        setLastCheckInResult(successResult);

        if (soundEnabled) {
          if (successResult.isVIP) {
            playSound("vip");
          } else if (successResult.isBlacklisted) {
            playSound("warning");
          } else {
            playSound("success");
          }
        }

        onCheckInSuccess?.(successResult);

        // Update results to reflect check-in
        setResults((prev) =>
          prev.map((r) =>
            r.id === reservation.id
              ? {
                  ...r,
                  status: "checked_in" as const,
                  checkInTime: new Date().toISOString(),
                }
              : r
          )
        );
      } catch (error) {
        console.error("[ManualSearch] Check-in error:", error);
        if (soundEnabled) {
          playSound("error");
        }
      } finally {
        setIsCheckingIn(false);
        setSelectedReservation(null);
      }
    },
    [checkIn, soundEnabled, onCheckInSuccess, onCheckInError]
  );

  const clearSearch = () => {
    setQuery("");
    setResults([]);
  };

  // Generate table location from reservation
  const getTableLocation = (reservation: Reservation): TableLocation | null => {
    if (!selectedEvent?.venueLayout || !reservation.tableId) return null;

    const table = selectedEvent.venueLayout.tables?.find(
      (t) => t.id === reservation.tableId
    );
    if (!table) return null;

    return {
      tableId: table.id,
      label: table.label,
      x: table.x,
      y: table.y,
      section: table.section,
      directionText: `Masa ${table.label}`,
    };
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          type="text"
          placeholder="İsim veya telefon ile ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Search Results */}
      <div className="space-y-3">
        {isSearching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <span className="ml-2 text-slate-400">Aranıyor...</span>
          </div>
        ) : query && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mb-3">
              <Search className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">Sonuç bulunamadı</p>
            <p className="text-slate-500 text-xs mt-1">
              Farklı bir arama terimi deneyin
            </p>
          </div>
        ) : !query ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mb-3">
              <User className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">Misafir Ara</p>
            <p className="text-slate-500 text-xs mt-1">
              İsim veya telefon numarası girin
            </p>
          </div>
        ) : (
          results.map((reservation) => (
            <GuestCard
              key={reservation.id}
              reservation={reservation}
              tableLocation={getTableLocation(reservation)}
              showCheckInButton={
                reservation.status !== "checked_in" &&
                reservation.status !== "cancelled"
              }
              onCheckIn={() => handleCheckIn(reservation)}
              onShowTableLocation={() => {
                setSelectedReservation(reservation);
                setShowTableLocator(true);
              }}
              isLoading={
                isCheckingIn && selectedReservation?.id === reservation.id
              }
            />
          ))
        )}
      </div>

      {/* Table Locator Modal */}
      {selectedReservation && selectedEvent?.venueLayout && (
        <TableLocatorModal
          isOpen={showTableLocator}
          onClose={() => setShowTableLocator(false)}
          tableLocation={getTableLocation(selectedReservation)!}
          venueLayout={selectedEvent.venueLayout}
        />
      )}
    </div>
  );
}
