import { describe, expect, it } from "vitest";
import { saleStateOf } from "@/features/ticketing/sale-state";

const base = {
  planningStage: "on_sale",
  status: "published",
  saleStartsAt: null,
  saleEndsAt: null,
  providerActive: true,
  now: new Date("2027-01-01T10:00:00Z"),
} as const;

describe("saleStateOf", () => {
  it.each([
    ["satışta, pencere yok", {}, "open"],
    ["aktif etkinlik", { status: "active" }, "open"],
    ["başlangıçtan önce", { saleStartsAt: new Date("2027-01-01T10:00:01Z") }, "not_started"],
    ["bitiş anında", { saleEndsAt: new Date("2027-01-01T10:00:00Z") }, "ended"],
    ["sağlayıcı yok", { providerActive: false }, "closed"],
    ["satış kapalı aşaması", { planningStage: "sales_closed" }, "closed"],
    ["satış kapalı, pencere geçmiş olsa da closed", { planningStage: "sales_closed", saleEndsAt: new Date("2026-12-01T00:00:00Z") }, "closed"],
    ["fiyatlandı aşaması görünmez", { planningStage: "priced" }, null],
    ["taslak görünmez", { status: "draft" }, null],
    ["tamamlanmış görünmez", { status: "completed" }, null],
    ["iptal görünmez", { status: "cancelled" }, null],
  ] as const)("%s", (_, patch, expected) =>
    expect(saleStateOf({ ...base, ...patch })).toBe(expected));
});
