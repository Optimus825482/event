"use client";

/**
 * QR Scanner Komponenti - html5-qrcode ile kamera tabanlı QR okuyucu
 * Requirement: 4.1 - QR kod okutarak check-in
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Camera, CameraOff, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "./button";

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
  width?: number;
  height?: number;
}

export function QRScanner({
  onScan,
  onError,
  width = 300,
  height = 300,
}: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerIdRef = useRef(`qr-scanner-${Date.now()}`);

  // Kameraları listele
  const getCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Arka kamerayı tercih et (mobil için)
        const backCamera = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("arka")
        );
        setSelectedCamera(backCamera?.id || devices[0].id);
        setHasPermission(true);
      } else {
        setError("Kamera bulunamadı");
        setHasPermission(false);
      }
    } catch (err: unknown) {
      console.error("[QRScanner] Kamera erişim hatası:", err);
      setError("Kamera erişimi reddedildi");
      setHasPermission(false);
      onError?.("Kamera erişimi reddedildi");
    }
  }, [onError]);

  // Scanner'ı başlat
  const startScanner = useCallback(async () => {
    if (!selectedCamera || isScanning) return;

    try {
      setError(null);

      // Önceki scanner'ı temizle
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      }

      // Yeni scanner oluştur
      scannerRef.current = new Html5Qrcode(scannerIdRef.current);

      await scannerRef.current.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          // QR kod okundu
          onScan(decodedText);
        },
        () => {
          // QR kod bulunamadı - sessizce devam et
        }
      );

      setIsScanning(true);
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[QRScanner] Başlatma hatası:", error);
      setError(error.message || "Kamera başlatılamadı");
      onError?.(error.message || "Kamera başlatılamadı");
    }
  }, [selectedCamera, isScanning, onScan, onError]);

  // Scanner'ı durdur
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error("[QRScanner] Durdurma hatası:", err);
      }
    }
    setIsScanning(false);
  }, []);

  // Component mount - kameraları al
  useEffect(() => {
    getCameras();

    return () => {
      // Cleanup
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === Html5QrcodeScannerState.SCANNING) {
            scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (err) {
          // Sessizce devam et
        }
      }
    };
  }, [getCameras]);

  // Kamera değiştiğinde yeniden başlat
  const handleCameraChange = async (cameraId: string) => {
    await stopScanner();
    setSelectedCamera(cameraId);
  };

  // Kamera seçildikten sonra otomatik başlat
  useEffect(() => {
    if (selectedCamera && hasPermission && !isScanning) {
      // Küçük bir gecikme ile başlat
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedCamera, hasPermission]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Kamera seçici */}
      {cameras.length > 1 && (
        <select
          value={selectedCamera}
          onChange={(e) => handleCameraChange(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm w-full max-w-xs"
        >
          {cameras.map((camera) => (
            <option key={camera.id} value={camera.id}>
              {camera.label || `Kamera ${camera.id.slice(0, 8)}`}
            </option>
          ))}
        </select>
      )}

      {/* Scanner container */}
      <div
        ref={containerRef}
        className="relative bg-slate-900 rounded-lg overflow-hidden border-2 border-slate-700"
        style={{ width, height }}
      >
        {/* QR Scanner element */}
        <div id={scannerIdRef.current} className="w-full h-full" />

        {/* İzin yok veya hata durumu */}
        {hasPermission === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-center p-4">
            <CameraOff className="w-12 h-12 text-slate-500 mb-3" />
            <p className="text-slate-400 text-sm mb-3">
              {error || "Kamera erişimi gerekli"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={getCameras}
              className="border-slate-600"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tekrar Dene
            </Button>
          </div>
        )}

        {/* Yükleniyor */}
        {hasPermission === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-2" />
            <p className="text-slate-400 text-sm">Kamera yükleniyor...</p>
          </div>
        )}

        {/* Hata mesajı */}
        {error && hasPermission && (
          <div className="absolute bottom-0 left-0 right-0 bg-red-500/90 text-white text-xs p-2 text-center">
            <AlertCircle className="w-3 h-3 inline mr-1" />
            {error}
          </div>
        )}
      </div>

      {/* Kontrol butonları */}
      <div className="flex gap-2">
        {isScanning ? (
          <Button
            variant="outline"
            size="sm"
            onClick={stopScanner}
            className="border-slate-600"
          >
            <CameraOff className="w-4 h-4 mr-2" />
            Kamerayı Kapat
          </Button>
        ) : (
          hasPermission && (
            <Button
              variant="default"
              size="sm"
              onClick={startScanner}
              className="bg-blue-600"
            >
              <Camera className="w-4 h-4 mr-2" />
              Kamerayı Aç
            </Button>
          )
        )}
      </div>
    </div>
  );
}
