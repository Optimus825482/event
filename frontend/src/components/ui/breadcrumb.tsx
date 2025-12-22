"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

// Path segment'lerini Türkçe label'lara çevir
const PATH_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  events: "Etkinlikler",
  staff: "Ekip Yönetimi",
  venues: "Alan Şablonları",
  templates: "Şablonlar",
  admin: "Admin",
  settings: "Ayarlar",
  users: "Kullanıcılar",
  "team-organization": "Ekip Organizasyonu",
  venue: "Alan Planı",
  new: "Yeni",
  edit: "Düzenle",
  personnel: "Personel Yönetimi",
  teams: "Ekip Organizasyonu",
  "event-assignment": "Etkinlik Ekip Organizasyonu",
  reservations: "Rezervasyonlar",
  customers: "Müşteriler",
  invitations: "Davetiyeler",
};

// Dinamik segment'leri tespit et (UUID veya ID formatında)
const isDynamicSegment = (segment: string): boolean => {
  // UUID formatı veya sadece sayı
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment
    ) || /^\d+$/.test(segment)
  );
};

export function Breadcrumb() {
  const pathname = usePathname();

  // Path'i segment'lere ayır
  const segments = pathname.split("/").filter(Boolean);

  // Breadcrumb item'larını oluştur
  const breadcrumbItems: { label: string; href: string; isLast: boolean }[] =
    [];

  let currentPath = "";

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    // Dinamik segment'leri atla (ID'ler)
    if (isDynamicSegment(segment)) {
      return;
    }

    const label =
      PATH_LABELS[segment] ||
      segment.charAt(0).toUpperCase() + segment.slice(1);

    breadcrumbItems.push({
      label,
      href: currentPath,
      isLast,
    });
  });

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link
        href="/dashboard"
        className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
      >
        <Home className="w-4 h-4" />
        <span>Etkinlik Planlama</span>
      </Link>

      {breadcrumbItems.map((item, index) => (
        <div key={item.href} className="flex items-center gap-1">
          <ChevronRight className="w-4 h-4 text-slate-600" />
          {item.isLast ? (
            <span className="text-slate-300 font-medium">{item.label}</span>
          ) : (
            <Link
              href={item.href}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
