import ExcelJS from "exceljs";
import { expect } from "vitest";
import { db } from "@/db/client";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import * as f from "../../helpers/factories";

export type Cell = string | number | null | { formula: string; result: string | number };

/** Bellekte .xlsx üretir (ilk sayfa `rows`, istenirse ikinci sayfa). */
export async function xlsx(rows: Cell[][], extraSheetRows?: Cell[][]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sayfa1");
  for (const row of rows) sheet.addRow(row.map((c) => (c === null ? null : c)));
  if (extraSheetRows) {
    const second = workbook.addWorksheet("Sayfa2");
    for (const row of extraSheetRows) second.addRow(row);
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function actorOf(role: Role = "organizer"): Promise<Actor> {
  const u = await f.createUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: u.staffId, memberships: [], permissions: [] };
}

export async function expectDomain(promise: Promise<unknown>, code: "conflict" | "not_found" | "invalid", message?: RegExp | string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
  if (typeof message === "string") expect((err as DomainError).message).toBe(message);
  if (message instanceof RegExp) expect((err as DomainError).message).toMatch(message);
  return err as DomainError;
}

/** Yayında etkinlik (organizatör = actor) + verilen kapasitelerle masalar. */
export async function bookableEvent(capacities: Record<string, number>, actor?: Actor) {
  const owner = actor ?? (await actorOf("organizer"));
  const event = await f.createEvent(db, { status: "published", organizerId: owner.id });
  const tables: Record<string, Awaited<ReturnType<typeof f.createTable>>> = {};
  for (const [label, capacity] of Object.entries(capacities)) {
    tables[label] = await f.createTable(db, event.id, { label, capacity });
  }
  return { owner, event, tables };
}
