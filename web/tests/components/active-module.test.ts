import { describe, expect, it } from "vitest";
import { buildCrumbs, findActiveGroup, isItemActive } from "@/components/layout/active-module";
import { NAV_ITEMS } from "@/features/auth/nav";
import type { ShellGroup, ShellItem } from "@/components/layout/shell-nav";

const groups: ShellGroup[] = [
  { key: "events", label: "Etkinlik", accent: "blue", icon: "calendar", extraPrefixes: ["/import/assignments"], items: [{ href: "/events", label: "Etkinlikler", icon: "calendar" }] },
  { key: "reservations", label: "Rezervasyon", accent: "purple", icon: "ticket", extraPrefixes: [], items: [{ href: "/reservations", label: "Rezervasyonlar", icon: "ticket" }] },
];

describe("findActiveGroup", () => {
  it("yola en uzun önekle uyan modülü seçer", () => {
    expect(findActiveGroup(groups, "/reservations/abc")?.key).toBe("reservations");
    expect(findActiveGroup(groups, "/import/assignments/x")?.key).toBe("events");
  });

  it("uyuşmayan yolda ilk modüle düşer", () => {
    expect(findActiveGroup(groups, "/")?.key).toBe("events");
  });
});

describe("isItemActive", () => {
  const root: ShellItem = { href: "/fnb/team", label: "Pano", icon: "star" };
  const events: ShellItem = { href: "/fnb/team/events", label: "Etkinlikler", icon: "calendar" };
  const items: ShellItem[] = [root, events, { href: "/fnb/team/members", label: "Ekibim", icon: "users" }];

  it("kök öğe yalnızca tam eşleşmede ya da daha uzun kardeş uymadığında etkindir", () => {
    expect(isItemActive("/fnb/team", root, items)).toBe(true);
    expect(isItemActive("/fnb/team/events", root, items)).toBe(false);
    expect(isItemActive("/fnb/team/events/abc", root, items)).toBe(false);
    expect(isItemActive("/fnb/team/events/abc", events, items)).toBe(true);
    expect(isItemActive("/fnb/team/other", root, items)).toBe(true);
  });

  it("F&B ekip yollarında en uzun eşleşen öğe etkindir; üst F&B öğesi etkin değildir", () => {
    const fnbEvents: ShellItem = { href: "/fnb", label: "Etkinlikler", icon: "calendar" };
    const team: ShellItem = { href: "/fnb/team", label: "Ekip Panosu", icon: "layout-dashboard" };
    const reviews: ShellItem = { href: "/fnb/team/reviews", label: "Değerlendirmeler", icon: "star" };
    const fnbItems: ShellItem[] = [fnbEvents, team, reviews];
    expect(isItemActive("/fnb/team/reviews/abc", reviews, fnbItems)).toBe(true);
    expect(isItemActive("/fnb/team/reviews/abc", team, fnbItems)).toBe(false);
    expect(isItemActive("/fnb/team/reviews/abc", fnbEvents, fnbItems)).toBe(false);
  });

  it("kardeşsiz öğe önek eşleşmesini korur", () => {
    expect(isItemActive("/events/1", { href: "/events", label: "E", icon: "calendar" })).toBe(true);
    expect(isItemActive("/eventsx", { href: "/events", label: "E", icon: "calendar" })).toBe(false);
  });
});

describe("buildCrumbs F&B ekip yolları", () => {
  const navLinks = new Set(NAV_ITEMS.map((i) => i.href));
  const id = "3f2c1a9e-1111-4222-8333-444455556666";
  const navLabel = (href: string) => NAV_ITEMS.find((i) => i.href === href)?.label;

  it("ekip üyesi sayfası kırıntıları Türkçe ve menü etiketleriyle aynıdır", () => {
    expect(buildCrumbs(`/fnb/team/members/${id}`, navLinks)).toEqual([
      { label: "Etkinlikler", href: "/fnb" },
      { label: "Ekip Panosu", href: "/fnb/team" },
      { label: "Ekibim", href: "/fnb/team/members" },
      { label: "Detay", href: null },
    ]);
    expect(navLabel("/fnb/team")).toBe("Ekip Panosu");
    expect(navLabel("/fnb/team/members")).toBe("Ekibim");
  });

  it("değerlendirme kurulu kırıntıları Türkçe ve menü etiketiyle aynıdır", () => {
    expect(buildCrumbs(`/fnb/team/reviews/${id}`, navLinks)).toEqual([
      { label: "Etkinlikler", href: "/fnb" },
      { label: "Ekip Panosu", href: "/fnb/team" },
      { label: "Değerlendirmeler", href: "/fnb/team/reviews" },
      { label: "Detay", href: null },
    ]);
    expect(navLabel("/fnb/team/reviews")).toBe("Değerlendirmeler");
  });
});

describe("buildCrumbs", () => {
  const linkable = new Set(["/events"]);

  it("kimlik segmentini Detay yapar ve yalnızca gerçek sayfaları bağlar", () => {
    const id = "3f2c1a9e-1111-4222-8333-444455556666";
    expect(buildCrumbs(`/events/${id}/venue`, linkable)).toEqual([
      { label: "Etkinlikler", href: "/events" },
      { label: "Detay", href: `/events/${id}` },
      { label: "Yerleşim Planı", href: null },
    ]);
  });
});
