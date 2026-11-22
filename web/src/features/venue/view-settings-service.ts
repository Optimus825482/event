import type { Db, Tx } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { resolveViewSettings, type ViewSettings } from "./editor/view-chrome";

/** Düzenleyicinin ızgara ayarları (sistem ayarları: ızgara boyutu, ızgaraya yapış, ızgarayı göster). Satır yoksa varsayılan. */
export async function getEditorViewSettings(db: Db | Tx): Promise<ViewSettings> {
  const [row] = await db
    .select({ gridSize: systemSettings.defaultGridSize, snap: systemSettings.snapToGrid, showGrid: systemSettings.showGridByDefault })
    .from(systemSettings)
    .limit(1);
  return resolveViewSettings(row);
}
