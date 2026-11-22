"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tam ekran: düzenleyici CSS ile ekranı kaplar (iletişim kutuları belge gövdesine taşındığı için görünür kalır);
 * tarayıcı destekliyorsa ayrıca Fullscreen API ile tarayıcı çerçevesi de gizlenir. Esc ile çıkış durumu eşitler.
 */
export function useFullscreen(): { fullscreen: boolean; toggle: () => void } {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  useEffect(() => {
    // Bileşen tam ekrandayken kaldırılırsa tarayıcı tam ekrandan çıkar.
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  const toggle = useCallback(() => {
    if (fullscreen) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setFullscreen(false);
      return;
    }
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    setFullscreen(true);
  }, [fullscreen]);

  return { fullscreen, toggle };
}
