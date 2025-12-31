"use client";

// Bu layout, check-in/[eventId]/layout sayfası için Navbar'ı gizler
// Sayfa kendi header'ını kullanır (masa arama, 2D/3D, zoom kontrolleri)

export default function CheckInLayoutPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="fixed inset-0 z-[100]">{children}</div>;
}
