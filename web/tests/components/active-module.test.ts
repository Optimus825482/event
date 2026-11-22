import { describe, expect, it } from "vitest";
import { buildCrumbs, findActiveGroup } from "@/components/layout/active-module";
import type { ShellGroup } from "@/components/layout/shell-nav";

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
