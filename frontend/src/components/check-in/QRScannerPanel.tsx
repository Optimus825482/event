"use client";

/**
 * QR Scanner Panel - QR kod tarama ve check-in
 * Requirements: 2.1, 2.3, 2.5, 2.6
 */

import { useState, useCallback, useEffect } from "react";
import { QRScanner } from "@/components/ui/qr-scanner";
import { GuestCard } from "./GuestCard";
import { TableLocatorModal } from "./TableLocatorModal";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCheckInStore } from "@/store/check-in-store";
import { playSound } from "@/lib/sound-feedback";
import type {
  Reservation,
  CheckInResult,
  CheckInError,
  TableLocation,
} from "@/store/check-in-store";

interface QRScannerPanelProps {
  eventId: string;
  onCheckInSuccess?: (result: CheckInResult) => void;
  onCheckInError?: (error: CheckInError) => void;
}

type ScanState =
  | { type: "idle" }
  | { type: "scanning" }
  | { type: "processing"; qrCode: string }
  | { type: "success"; result: CheckInResult }
  | { type: "error"; error: CheckInError }
  | {
      type: "preview";
      reservation: Reservation;
      tableLocation: TableLocation | null;
    };

export function QRScannerPanel({
  eventId,
  onCheckInSuccess,
  onCheckInError,
}: QRScannerPanelProps) {
  const [scanState, setScanState] = useState<ScanState>({ type: "idle" });
  const [showTableLocator, setShowTableLocator] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const { checkIn, selectedEvent, soundEnabled, reservations } =
    useCheckInStore();

  // Debounce için son tarama zamanı
  const [lastScanTime, setLastScanTime] = useState(0);
  const SCAN_DEBOUNCE_MS = 2000;

  const handleScan = useCallback(
    async (qrCode: string) => {
      // Debounce kontrolü
      const now = Date.now();
      if (now - lastScanTime < SCAN_DEBOUNCE_MS) return;
      if (qrCode === lastScannedCode && scanState.type !== "idle") return;

      setLastScanTime(now);
      setLastScannedCode(qrCode);
      setScanState({ type: "processing", qrCode });

      try {
        const result = await checkIn(qrCode);

        // Error response kontrolü
        if ("code" in result) {
          const error = result as CheckInError;
          setScanState({ type: "error", error });

          // Ses çal
          if (soundEnabled) {
            if (error.code === "ALREADY_CHECKED_IN") {
              playSound("warning");
            } else {
              playSound("error");
            }
          }

          onCheckInError?.(error);
          return;
        }

        // Success response
        const successResult = result as CheckInResult;
        setScanState({ type: "success", result: successResult });

        // Ses çal
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

        // 3 saniye sonra idle'a dön
        setTimeout(() => {
          setScanState({ type: "idle" });
          setLastScannedCode(null);
        }, 3000);
      } catch (err) {
        console.error("[QRScannerPanel] Check-in error:", err);
        setScanState({
          type: "error",
          error: {
            code: "NETWORK_ERROR",
            message: "Bağlantı hatası oluştu",
          },
        });

        if (soundEnabled) {
          playSound("error");
        }
      }
    },
    [
      checkIn,
      soundEnabled,
      lastScanTime,
      lastScannedCode,
      scanState.type,
      onCheckInSuccess,
      onCheckInError,
    ]
  );

  const handleScanError = useCallback((error: string) => {
    console.error("[QRScannerPanel] Scanner error:", error);
  }, []);

  const resetScanner = () => {
    setScanState({ type: "idle" });
    setLastScannedCode(null);
  };

  // Render based on state
  const renderContent = () => {
    switch (scanState.type) {
      case "processing":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-300">İşleniyor...</p>
          </div>
        );

      case "success":
        return (
          <div className="space-y-4">
            {/* Success Animation */}
            <div className="flex flex-col items-center py-6 animate-in fade-in zoom-in duration-300">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                  scanState.result.isVIP
                    ? "bg-yellow-500/20"
                    : scanState.result.isBlacklisted
                    ? "bg-orange-500/20"
                    : "bg-green-500/20"
                }`}
              >
                <CheckCircle
                  className={`w-10 h-10 ${
                    scanState.result.isVIP
                      ? "text-yellow-400"
                      : scanState.result.isBlacklisted
                      ? "text-orange-400"
                      : "text-green-400"
                  }`}
                />
              </div>
              <h3 className="text-xl font-semibold text-white mb-1">
                {scanState.result.isVIP ? "VIP Misafir!" : "Giriş Başarılı!"}
              </h3>
              <p className="text-slate-400 text-sm">
                {scanState.result.message}
              </p>
            </div>

            {/* Guest Card */}
            <GuestCard
              reservation={scanState.result.reservation}
              tableLocation={scanState.result.tableLocation}
              showCheckInButton={false}
              onShowTableLocation={() => setShowTableLocator(true)}
            />

            {/* Table Locator Button */}
            {scanState.result.tableLocation && (
              <Button
                onClick={() => setShowTableLocator(true)}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Masa Konumunu Göster
              </Button>
            )}
          </div>
        );

      case "error":
        return (
          <div className="space-y-4">
            {/* Error Display */}
            <div className="flex flex-col items-center py-6 animate-in fade-in zoom-in duration-300">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                  scanState.error.code === "ALREADY_CHECKED_IN"
                    ? "bg-yellow-500/20"
                    : "bg-red-500/20"
                }`}
              >
                {scanState.error.code === "ALREADY_CHECKED_IN" ? (
                  <AlertTriangle className="w-10 h-10 text-yellow-400" />
                ) : (
                  <XCircle className="w-10 h-10 text-red-400" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-white mb-1">
                {scanState.error.code === "ALREADY_CHECKED_IN"
                  ? "Zaten Giriş Yapılmış"
                  : "Hata"}
              </h3>
              <p className="text-slate-400 text-sm text-center">
                {scanState.error.message}
              </p>
              {scanState.error.originalCheckInTime && (
                <p className="text-slate-500 text-xs mt-2">
                  Giriş zamanı:{" "}
                  {new Date(
                    scanState.error.originalCheckInTime
                  ).toLocaleTimeString("tr-TR")}
                </p>
              )}
            </div>

            {/* Retry Button */}
            <Button
              onClick={resetScanner}
              variant="outline"
              className="w-full border-slate-600"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Yeni Tarama
            </Button>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            {/* QR Scanner */}
            <div className="flex justify-center">
              <QRScanner
                onScan={handleScan}
                onError={handleScanError}
                width={300}
                height={300}
              />
            </div>

            {/* Instructions */}
            <div className="text-center text-slate-400 text-sm">
              <p>QR kodu kameraya gösterin</p>
              <p className="text-xs mt-1">Otomatik olarak taranacaktır</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {renderContent()}

      {/* Table Locator Modal */}
      {scanState.type === "success" &&
        scanState.result.tableLocation &&
        selectedEvent?.venueLayout && (
          <TableLocatorModal
            isOpen={showTableLocator}
            onClose={() => setShowTableLocator(false)}
            tableLocation={scanState.result.tableLocation}
            venueLayout={selectedEvent.venueLayout}
          />
        )}
    </div>
  );
}
