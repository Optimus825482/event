import { readFileSync } from "node:fs";
import path from "node:path";

export type SeedTable = { id: string; label: string; seats: number };

export type SeedEvent = {
  id: string;
  name: string;
  saleMode: "table" | "seat";
  tables: SeedTable[];
};

export type EventKey = "gala" | "koltuk" | "masa" | "icerik";

export type CrossState = {
  eventId: string;
  tables: SeedTable[];
  events: Record<EventKey, SeedEvent>;
  users: { admin: string; entertainment: string };
  coreUrl: string;
};

/** `start-core.mjs` tohumunun yazdığı durum; çekirdek adresi ortamdan gelir. */
export function crossState(): CrossState {
  const raw = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "..", ".state.json"), "utf8")) as Omit<
    CrossState,
    "coreUrl"
  >;
  return { ...raw, coreUrl: `http://localhost:${process.env.E2E_PORT ?? 3460}` };
}
