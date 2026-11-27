import { sql, type SQL } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, systemSettings } from "@/db/schema";

/** Sistem ayarlarındaki `sales_demo_enabled` değerini okur; satır yoksa oluşturmaz, `false` döner. */
export async function salesDemoEnabled(ex: Db | Tx): Promise<boolean> {
  const [row] = await ex
    .select({ salesDemoEnabled: systemSettings.salesDemoEnabled })
    .from(systemSettings)
    .limit(1);
  return row?.salesDemoEnabled ?? false;
}

/** Satış kataloğunun demo anahtarıyla eşleşen etkinlikleri süzmesi için SQL koşulu. */
export function matchesDemoMode(): SQL {
  return sql`${events.isDemo} = coalesce((select sales_demo_enabled from system_settings limit 1), false)`;
}
