import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { listEventTables } from "@/features/events/service";
import { releaseHold } from "@/features/ticketing/orders-service";
import type { TableInput } from "@/features/venue/schemas";
import { saveLayout, type EventTableRow } from "@/features/venue/service";
import { DomainError } from "@/lib/action";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createPendingHold } from "../../helpers/ticketing";
import { saleEvent } from "../ticketing/fixtures";

const decor = { width: 1600, height: 900, elements: [] };

const toInput = (t: EventTableRow): TableInput => ({
  id: t.id,
  label: t.label,
  capacity: t.capacity,
  tableTypeId: t.tableTypeId,
  x: t.x,
  y: t.y,
  rotation: t.rotation,
  isLoca: t.isLoca,
  isVip: t.isVip,
  isPinned: t.isPinned,
  size: t.size,
  floor: t.floor,
  sortNumber: t.sortNumber,
});

async function twoTables() {
  const sale = await saleEvent({ tables: [{ label: "A1" }, { label: "B1" }] });
  const actor = await persistActor(db, managerActor("fnb"));
  const [a1, b1] = (await listEventTables(db, sale.event.id)).sort((x, y) => x.label.localeCompare(y.label));
  if (!a1 || !b1) throw new Error("masa yok");
  return { sale, actor, a1, b1 };
}

describe("bilet geçmişi olan masayı silme", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("bırakılmış (expired) bileti olan masa silinemez; hata masayı etiketiyle adlandırır", async () => {
    const { sale, actor, a1, b1 } = await twoTables();
    const hold = await createPendingHold(db, { eventId: sale.event.id, items: [{ tableId: a1.id, quantity: 2 }] });
    await releaseHold(db, hold.orderId);

    const err = await saveLayout(db, actor, { eventId: sale.event.id, tables: [toInput(b1)], decor }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe("conflict");
    expect((err as DomainError).message).toBe("A1 masasının bilet geçmişi var, silinemez");
    expect(await listEventTables(db, sale.event.id)).toHaveLength(2);
  });

  it("biletsiz masa silinebilir", async () => {
    const { sale, actor, a1 } = await twoTables();
    const saved = await saveLayout(db, actor, { eventId: sale.event.id, tables: [toInput(a1)], decor });
    expect(saved.tables.map((t) => t.label)).toEqual(["A1"]);
  });
});
