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
  options: UseSessionTimeoutOptions = {},
): SessionTimeoutState {
  const { warningTime = 2 * 60 * 1000, checkInterval = 30 * 1000 } = options;

  const { token, refreshToken, logout, setTokens } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const warningShownRef = useRef(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tüm timer'ları temizle
  const clearAllTimers = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
  }, []);

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

      // Önce tüm timer'ları temizle (eski token'a bağlı checkExpiry'yi durdur)
      clearAllTimers();

      // Warning'i kapat ve ref'i sıfırla
      setShowWarning(false);
      warningShownRef.current = false;

      // Zustand store'u güncelle — bu token değişikliği useEffect'i yeniden tetikleyecek
      setTokens(accessToken, newRefreshToken);

      return true;
    } catch (error) {
      console.error("Session uzatma hatası:", error);
      logout();
      return false;
    }
  }, [refreshToken, logout, setTokens, clearAllTimers]);

  // Uyarıyı kapat ve çıkış yap
  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    clearAllTimers();
    logout();
  }, [logout, clearAllTimers]);

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
        clearAllTimers();
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
              clearAllTimers();
              logout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };

    // İlk kontrol
    checkExpiry();

    // Periyodik kontrol
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    checkIntervalRef.current = setInterval(checkExpiry, checkInterval);

    return () => {
      clearAllTimers();
    };
  }, [token, warningTime, checkInterval, logout, clearAllTimers]);

  return { showWarning, remainingTime, extendSession, dismissWarning };
}
