import { count, eq, inArray, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, orders, systemSettings } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { authorize } from "@/features/auth/policy";
import { isAdmin } from "@/features/auth/scope";
import type { Actor } from "@/features/auth/session";
import { deleteImage } from "@/features/uploads/images";
import { logError } from "@/lib/log";
import { salesDemoEnabled } from "./flag";
import { purgeDemoData } from "./purge";
import { defaultSeedContext, seedDemoData, type SeedContext } from "./seed";

export type DemoStatus = {
  enabled: boolean;
  eventCount: number;
  orderCount: number;
};

const DEMO_LOCK = sql`select pg_advisory_xact_lock(hashtext('sales_demo'))`;
const SETTINGS_LOCK = sql`select pg_advisory_xact_lock(hashtext('system_settings'))`;

function requireAdmin(actor: Actor, verb: "view" | "edit"): void {
  authorize(actor, "settings", verb);
  if (!isAdmin(actor)) {
    throw new ForbiddenError("Bu işlem yalnızca yöneticilere açıktır");
  }
}

async function ensureSettingsRow(tx: Tx): Promise<{ id: string; salesDemoEnabled: boolean }> {
  await tx.execute(SETTINGS_LOCK);
  const [existing] = await tx
    .select({ id: systemSettings.id, salesDemoEnabled: systemSettings.salesDemoEnabled })
    .from(systemSettings)
    .limit(1);
  if (existing) return existing;
  const [created] = await tx
    .insert(systemSettings)
    .values({})
    .returning({ id: systemSettings.id, salesDemoEnabled: systemSettings.salesDemoEnabled });
  if (!created) throw new Error("Ayarlar oluşturulamadı");
  return created;
}

async function readDemoStatus(ex: Db | Tx): Promise<DemoStatus> {
  const enabled = await salesDemoEnabled(ex);
  const [evRow] = await ex
    .select({ value: count() })
    .from(events)
    .where(eq(events.isDemo, true));

  const demoEventIdsSq = ex.select({ id: events.id }).from(events).where(eq(events.isDemo, true));
  const [ordRow] = await ex
    .select({ value: count() })
    .from(orders)
    .where(inArray(orders.eventId, demoEventIdsSq));

  return {
    enabled,
    eventCount: Number(evRow?.value ?? 0),
    orderCount: Number(ordRow?.value ?? 0),
  };
}

async function cleanupFiles(paths: readonly string[], uploadRoot: string, context: string): Promise<void> {
  for (const imagePath of paths) {
    try {
      await deleteImage(imagePath, uploadRoot);
    } catch (error) {
      logError(context, error);
    }
  }
}

/** Mevcut demo modu durumunu (anahtar, demo etkinlik ve sipariş sayıları) döner. */
export async function getDemoStatus(ex: Db | Tx, actor: Actor): Promise<DemoStatus> {
  requireAdmin(actor, "view");
  return readDemoStatus(ex);
}

/** Satış sitesi demo anahtarını açar veya kapatır; ilk açılışta demo konserleri tohumlar. */
export async function setSalesDemoEnabled(
  db: Db,
  actor: Actor,
  input: { enabled: boolean },
  ctx?: Partial<SeedContext>,
): Promise<DemoStatus> {
  requireAdmin(actor, "edit");
  const seedCtx = defaultSeedContext(ctx);

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(DEMO_LOCK);
      if (input.enabled) {
        await seedDemoData(tx, actor, seedCtx);
      }
      const settingsRow = await ensureSettingsRow(tx);
      await tx
        .update(systemSettings)
        .set({ salesDemoEnabled: input.enabled })
        .where(eq(systemSettings.id, settingsRow.id));

      return readDemoStatus(tx);
    });
  } catch (error) {
    await cleanupFiles(seedCtx.written, seedCtx.uploadRoot, "demo.seed.rollback");
    throw error;
  }
}

/** Tüm demo verilerini siler ve yeniden tohumlar; anahtar durumunu değiştirmez. */
export async function resetDemoData(
  db: Db,
  actor: Actor,
  ctx?: Partial<SeedContext>,
): Promise<DemoStatus> {
  requireAdmin(actor, "edit");
  const seedCtx = defaultSeedContext(ctx);
  let toDelete: string[] = [];

  try {
    const status = await db.transaction(async (tx) => {
      await tx.execute(DEMO_LOCK);
      const purged = await purgeDemoData(tx);
      toDelete = purged.imagePaths;
      await seedDemoData(tx, actor, seedCtx);
      return readDemoStatus(tx);
    });
    await cleanupFiles(toDelete, seedCtx.uploadRoot, "demo.reset.cleanup");
    return status;
  } catch (error) {
    await cleanupFiles(seedCtx.written, seedCtx.uploadRoot, "demo.reset.rollback");
    throw error;
  }
}

/** Tüm demo verilerini kalıcı olarak siler ve demo anahtarını kapatır. */
export async function deleteDemoData(
  db: Db,
  actor: Actor,
  ctx?: Partial<SeedContext>,
): Promise<DemoStatus> {
  requireAdmin(actor, "edit");
  const seedCtx = defaultSeedContext(ctx);
  let toDelete: string[] = [];

  const status = await db.transaction(async (tx) => {
    await tx.execute(DEMO_LOCK);
    const purged = await purgeDemoData(tx);
    toDelete = purged.imagePaths;
    const settingsRow = await ensureSettingsRow(tx);
    await tx
      .update(systemSettings)
      .set({ salesDemoEnabled: false })
      .where(eq(systemSettings.id, settingsRow.id));
    return readDemoStatus(tx);
  });

  await cleanupFiles(toDelete, seedCtx.uploadRoot, "demo.delete.cleanup");
  return status;
}
