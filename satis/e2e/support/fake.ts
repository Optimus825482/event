import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EventDetail, OrderResponse } from "../../src/lib/core/contract";

type FakeFile = { coreUrl: string; events: { gala: EventDetail; bahar: EventDetail; kapali: EventDetail } };

/** Global kurulumun yazdığı sahte çekirdek durumu. */
export function fakeState(): FakeFile {
  return JSON.parse(readFileSync(resolve(import.meta.dirname, "../.state/fake.json"), "utf8")) as FakeFile;
}

export function tableId(event: EventDetail, label: string): string {
  const table = event.plan.tables.find((t) => t.label === label);
  if (!table) throw new Error(`Masa bulunamadı: ${label}`);
  return table.id;
}

async function control<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${fakeState().coreUrl}/__fake/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Sahte çekirdek ${path}: ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

/** Başka bir alıcı gibi masa tutar. */
export const holdAs = (eventId: string, id: string, quantity: number) =>
  control<OrderResponse>("hold-as", { eventId, tableId: id, quantity });

/** remainingMs verilirse sipariş hemen bitmez; o kadar tutma süresi kalır. */
export const expireOrder = (orderToken: string, remainingMs?: number) =>
  control<{ ok: true }>("expire-order", { orderToken, remainingMs });

export const resetOrders = () => control<{ ok: true }>("reset-orders", {});

export const fakeRequests = () =>
  control<{ method: string; path: string; authorization: string | null; clientIp: string | null }[]>("requests");
