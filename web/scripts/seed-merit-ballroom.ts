/**
 * "Merit Royal Diamond Ballroom (2004 Pax)" salon şablonunu ekler ya da günceller (ada göre; yinelenince çoğalmaz).
 * Şablon herkese açıktır ve sahipsizdir; etkinliğin yerleşim ekranında "Şablonlar"dan uygulanır.
 *
 *   npx tsx --env-file=.env.local scripts/seed-merit-ballroom.ts
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { venueTemplates } from "@/db/schema";
import { MERIT_BALLROOM_NAME, meritBallroomLayout } from "@/features/venue/presets/merit-ballroom";

const DESCRIPTION = "Gala krokisi: 161 masa × 12, 12 loca × 6 (2. kat), T catwalk'lı sahne, 3 bar, 2 ekran, sistem kontrol.";

async function main(): Promise<void> {
  const layoutData = meritBallroomLayout();
  const [existing] = await db.select({ id: venueTemplates.id }).from(venueTemplates).where(eq(venueTemplates.name, MERIT_BALLROOM_NAME));
  if (existing) {
    await db
      .update(venueTemplates)
      .set({ layoutData, description: DESCRIPTION, isPublic: true, updatedAt: new Date() })
      .where(eq(venueTemplates.id, existing.id));
    console.log(`Şablon güncellendi: ${MERIT_BALLROOM_NAME} (${existing.id})`);
    return;
  }
  const [created] = await db
    .insert(venueTemplates)
    .values({ name: MERIT_BALLROOM_NAME, description: DESCRIPTION, layoutData, isPublic: true })
    .returning({ id: venueTemplates.id });
  console.log(`Şablon eklendi: ${MERIT_BALLROOM_NAME} (${created?.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
