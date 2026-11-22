"use client";

import { OfflineBanner, InstallBanner } from "./pwa-banners";
import { SessionTimeoutModal } from "./session-timeout-modal";
import { UpdatePrompt } from "./update-prompt";

/** Kabuğun üstünde duran yüzen bileşenler: bağlantı şeridi, yükleme istemi, oturum süresi uyarısı. */
export function AppOverlays({ sessionExpiresAt }: { sessionExpiresAt: number | null }) {
  return (
    <>
      <OfflineBanner />
      <InstallBanner />
      <SessionTimeoutModal initialExpiresAt={sessionExpiresAt} />
      <UpdatePrompt />
    </>
  );
}
