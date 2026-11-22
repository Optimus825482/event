import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/db/client";
import { FitToWidth } from "@/features/invitations/components/fit-to-width";
import { InvitationSurface } from "@/features/invitations/components/invitation-surface";
import { getPublicInvitation } from "@/features/invitations/public";
import { checkInvitationRate } from "@/features/invitations/rate-limit";

// Bağlantıya sahip olan herkes görür; arama motorlarına açılmaz ve önbelleğe alınmaz.
export const metadata: Metadata = {
  title: "Davetiye",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function PublicInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Veritabanına dokunmadan önce: IP başına hız sınırı. Sayfa durum kodu belirleyemediğinden 429 veren uca yönlendirilir.
  const rate = checkInvitationRate(await headers());
  if (!rate.allowed) redirect(`/i/${encodeURIComponent(token)}/limited?r=${rate.retryAfterSeconds}`);

  const invitation = await getPublicInvitation(db, token);
  if (!invitation) notFound();

  const qrSrc = await QRCode.toDataURL(invitation.qrPayload, { width: 300, margin: 1 });
  const imageSrc = (uploadPath: string) => `/i/${encodeURIComponent(token)}/image?p=${encodeURIComponent(uploadPath)}`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center gap-4 bg-muted/30 p-4">
      <h1 className="sr-only">{invitation.eventName} davetiyesi</h1>
      <FitToWidth width={invitation.width} height={invitation.height}>
        <InvitationSurface
          width={invitation.width}
          height={invitation.height}
          backgroundColor={invitation.backgroundColor}
          backgroundGradient={invitation.backgroundGradient}
          backgroundImage={invitation.backgroundImage}
          elements={invitation.elements}
          imageSrc={imageSrc}
          qrSrc={qrSrc}
        />
      </FitToWidth>
      <p className="text-center text-sm text-muted-foreground">
        {invitation.guestName} - Masa {invitation.tableLabel}. Girişte QR kodunuzu gösterin.
      </p>
    </main>
  );
}
