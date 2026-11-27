import { mkdtemp, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { DEMO_CONCERTS, type DemoConcert } from "@/features/demo/concerts";
import { defaultSeedContext, seedDemoData, type SeedContext } from "@/features/demo/seed";
import { adminActor, persistActor } from "../../helpers/actors";

export async function tmpUploadRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "ef-demo-test-"));
}

export async function filesUnder(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, prefix: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), rel);
      } else {
        out.push(rel);
      }
    }
  }
  await walk(root, "");
  return out.sort();
}

export function oneConcert(key = "levent"): DemoConcert[] {
  const found = DEMO_CONCERTS.find((c) => c.key === key);
  if (!found) throw new Error(`Demo konser bulunamadı: ${key}`);
  return [found];
}

export async function seedOnce(o?: {
  concerts?: readonly DemoConcert[];
  now?: Date;
  uploadRoot?: string;
}): Promise<{ admin: Actor; ctx: SeedContext; eventIds: string[] }> {
  const admin = await persistActor(db, adminActor());
  const uploadRoot = o?.uploadRoot ?? (await tmpUploadRoot());
  const ctx = defaultSeedContext({
    uploadRoot,
    ...(o?.concerts !== undefined ? { concerts: o.concerts } : {}),
    ...(o?.now !== undefined ? { now: o.now } : {}),
  });
  const res = await db.transaction((tx) => seedDemoData(tx, admin, ctx));
  return { admin, ctx, eventIds: res.eventIds };
}
