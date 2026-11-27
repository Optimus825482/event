import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SALE_CATEGORIES, SALE_MODES as DOMAIN_SALE_MODES } from "@/domain/seating";
import {
  IMAGE_PATH_PATTERN,
  SALE_MODES,
  SALES_CATEGORIES,
  SALES_ERROR_CODES,
  SALES_ERROR_MESSAGES,
  SALES_ERROR_STATUS,
  createOrderBodySchema,
  lookupBodySchema,
  orderResponseSchema,
  payOrderBodySchema,
} from "@/features/sales-api/contract";

const UUID = "3f2b8c1e-4d5a-4e6f-8a9b-0c1d2e3f4a5b";
const pay = {
  buyer: { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" },
  acceptTerms: true,
  payment: { provider: "demo", action: "approve" },
};
const order = {
  orderId: UUID,
  eventId: UUID,
  eventName: "Yılbaşı Gecesi",
  startsAt: "2027-01-01T00:00:00.000Z",
  status: "pending",
  holdExpiresAt: "2027-01-01T00:15:00.000Z",
  currency: "EUR",
  total: "200.00",
  isDemo: true,
  pnr: null,
  items: [{ tableId: UUID, tableLabel: "A1", category: "vip", quantity: 2, unitPrice: "100.00" }],
  tickets: [],
  orderToken: "tok",
  demoNotice: null,
};
const create = { eventId: UUID, items: [{ tableId: UUID, quantity: 2 }], clientKey: UUID };

describe("satış API sözleşmesi", () => {
  it("sözleşme dosyası yalnızca zod içe aktarır (satis birebir kopyalar)", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/features/sales-api/contract.ts"),
      "utf8",
    );
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["zod"]);
  });

  it("her hata kodunun HTTP durumu ve Türkçe mesajı vardır", () => {
    expect(Object.keys(SALES_ERROR_STATUS).sort()).toEqual([...SALES_ERROR_CODES].sort());
    expect(Object.keys(SALES_ERROR_MESSAGES).sort()).toEqual([...SALES_ERROR_CODES].sort());
    expect(SALES_ERROR_STATUS).toMatchObject({
      invalid: 400, unauthorized: 401, payment_declined: 402, order_not_found: 404,
      seats_unavailable: 409, hold_expired: 409, rate_limited: 429, payments_disabled: 503,
      sales_api_disabled: 503,
    });
  });

  it("kategori kopyası alan sözlüğüyle aynıdır", () => expect(SALES_CATEGORIES).toEqual(SALE_CATEGORIES));

  it("ödeme gövdesi kart alanı kabul etmez", () => {
    expect(payOrderBodySchema.safeParse({ ...pay, payment: { ...pay.payment, cardNumber: "4111111111111111" } }).success).toBe(false);
    expect(payOrderBodySchema.safeParse({ ...pay, card: { number: "4111111111111111" } }).success).toBe(false);
    expect(payOrderBodySchema.safeParse(pay).success).toBe(true);
  });

  it("koşullar onaylanmadan ödeme gövdesi geçersizdir", () =>
    expect(payOrderBodySchema.safeParse({ ...pay, acceptTerms: false }).success).toBe(false));

  it("yalnızca demo sağlayıcı ve approve/decline kabul edilir", () => {
    expect(payOrderBodySchema.safeParse({ ...pay, payment: { provider: "iyzico", action: "approve" } }).success).toBe(false);
    expect(payOrderBodySchema.safeParse({ ...pay, payment: { provider: "demo", action: "capture" } }).success).toBe(false);
    expect(payOrderBodySchema.safeParse({ ...pay, payment: { provider: "demo", action: "decline" } }).success).toBe(true);
  });

  it("ad 100, e-posta 254 karakteri aşamaz; ad kırpılır", () => {
    const withBuyer = (b: object) => ({ ...pay, buyer: { ...pay.buyer, ...b } });
    expect(payOrderBodySchema.safeParse(withBuyer({ firstName: "a".repeat(101) })).success).toBe(false);
    expect(payOrderBodySchema.safeParse(withBuyer({ email: `${"a".repeat(250)}@x.co` })).success).toBe(false);
    const r = payOrderBodySchema.safeParse(withBuyer({ firstName: "  Ayşe " }));
    expect(r.success && r.data.buyer.firstName).toBe("Ayşe");
  });

  it("tutma gövdesi: kimlikler uuid, adet 1-50 tam sayı, en az bir kalem, fazladan alan yok", () => {
    const item = (quantity: number) => ({ tableId: UUID, quantity });
    for (const q of [0, 51, 1.5]) {
      expect(createOrderBodySchema.safeParse({ ...create, items: [item(q)] }).success).toBe(false);
    }
    expect(createOrderBodySchema.safeParse({ ...create, items: [] }).success).toBe(false);
    expect(createOrderBodySchema.safeParse({ ...create, eventId: "x" }).success).toBe(false);
    expect(createOrderBodySchema.safeParse({ ...create, coupon: "X" }).success).toBe(false);
    expect(createOrderBodySchema.safeParse({ ...create, items: Array.from({ length: 6 }, () => item(1)) }).success).toBe(true);
    expect(createOrderBodySchema.safeParse(create).success).toBe(true);
  });

  it("tutma gövdesindeki kimlikler küçük harfe indirilir", () => {
    const id = "A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D";
    const parsed = createOrderBodySchema.parse({ eventId: id, items: [{ tableId: id, quantity: 1 }], clientKey: id });
    const lower = id.toLowerCase();
    expect(parsed).toEqual({ eventId: lower, items: [{ tableId: lower, quantity: 1 }], clientKey: lower });
  });

  it("arama gövdesi fazladan alan kabul etmez", () => {
    expect(lookupBodySchema.safeParse({ pnr: "ABC", lastName: "Yılmaz" }).success).toBe(true);
    expect(lookupBodySchema.safeParse({ pnr: "ABC", lastName: "Yılmaz", email: "a@b.co" }).success).toBe(false);
  });

  it("sipariş yanıtı şeması alıcı alanı kabul etmez (sızıntı şemada yakalanır)", () => {
    expect(orderResponseSchema.safeParse(order).success).toBe(true);
    expect(orderResponseSchema.safeParse({ ...order, buyerEmail: "a@b.co" }).success).toBe(false);
    expect(orderResponseSchema.safeParse({ ...order, buyer: { email: "a@b.co" } }).success).toBe(false);
  });

  it("seatNos isteğe bağlıdır; adetle eşit uzunlukta ve tekil olmalıdır", () => {
    const item = (o: object) =>
      createOrderBodySchema.safeParse({ eventId: UUID, clientKey: UUID, items: [{ tableId: UUID, quantity: 2, ...o }] })
        .success;
    expect(item({})).toBe(true);
    expect(item({ seatNos: [3, 4] })).toBe(true);
    expect(item({ seatNos: [3] })).toBe(false);
    expect(item({ seatNos: [3, 3] })).toBe(false);
    expect(item({ seatNos: [0, 4] })).toBe(false);
    expect(item({ seatNos: [3, 1000] })).toBe(false);
  });

  it("satış şekli sabitleri alan modeliyle aynıdır", () => {
    expect([...SALE_MODES]).toEqual([...DOMAIN_SALE_MODES]);
  });

  it("hata kodu sayısı değişmedi", () => {
    expect(SALES_ERROR_CODES).toHaveLength(17);
  });

  it.each([
    "event/3f2b0c1e-0000-4000-8000-000000000001.webp",
    "artist/3f2b0c1e-0000-4000-8000-000000000001.webp",
  ])("%s geçerli görsel yoludur", (p) => {
    expect(IMAGE_PATH_PATTERN.test(p)).toBe(true);
  });

  it.each([
    "logo/3f2b0c1e-0000-4000-8000-000000000001.webp",
    "event/../x.webp",
    "event/a.webp",
    "/event/3f2b0c1e-0000-4000-8000-000000000001.webp",
  ])("%s reddedilir", (p) => {
    expect(IMAGE_PATH_PATTERN.test(p)).toBe(false);
  });
});
