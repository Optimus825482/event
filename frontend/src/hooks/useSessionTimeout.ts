"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import axios from "axios";

interface UseSessionTimeoutOptions {
  warningTime?: number; // Uyarı gösterilecek süre (ms) - default 2 dakika önce
  checkInterval?: number; // Kontrol aralığı (ms) - default 30 saniye
}

interface SessionTimeoutState {
  showWarning: boolean;
  remainingTime: number; // saniye
  extendSession: () => Promise<boolean>;
  dismissWarning: () => void;
}

// JWT token'dan exp claim'ini çıkar
function getTokenExpiry(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null; // ms'ye çevir
  } catch {
    return null;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function useSessionTimeout(
  options: UseSessionTimeoutOptions = {}
): SessionTimeoutState {
  const { warningTime = 2 * 60 * 1000, checkInterval = 30 * 1000 } = options;

  const { token, refreshToken, logout, setTokens } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const warningShownRef = useRef(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Session'ı uzat
  const extendSession = useCallback(async (): Promise<boolean> => {
    if (!refreshToken) {
      console.error("Refresh token bulunamadı");
      return false;
    }
    try {
      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refreshToken,
      });

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      if (!accessToken) {
        console.error("Refresh response'da accessToken bulunamadı");
        logout();
        return false;
      }

      // Zustand store'u güncelle (persist otomatik localStorage'ı günceller)
      setTokens(accessToken, newRefreshToken);

      // Warning'i kapat ve ref'i sıfırla
      setShowWarning(false);
      warningShownRef.current = false;

      // Countdown'ı temizle
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }

      return true;
    } catch (error) {
      console.error("Session uzatma hatası:", error);
      logout();
      return false;
    }
  }, [refreshToken, logout, setTokens]);

  // Uyarıyı kapat (oturum kapanacak)
  const dismissWarning = useCallback(() => {
    setShowWarning(false);
  }, []);

  // Token süresini kontrol et
  useEffect(() => {
    if (!token) return;

    const checkExpiry = () => {
      const expiry = getTokenExpiry(token);
      if (!expiry) return;

      const now = Date.now();
      const timeLeft = expiry - now;

      // Süre dolmuşsa logout
      if (timeLeft <= 0) {
        logout();
        return;
      }

      // Uyarı zamanı geldiyse ve henüz gösterilmediyse
      if (timeLeft <= warningTime && !warningShownRef.current) {
        warningShownRef.current = true;
        setShowWarning(true);
        setRemainingTime(Math.floor(timeLeft / 1000));

        // Geri sayım başlat
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setRemainingTime((prev) => {
            if (prev <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              logout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, checkInterval);

    return () => {
      clearInterval(interval);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [token, warningTime, checkInterval, logout]);

  return { showWarning, remainingTime, extendSession, dismissWarning };
}
