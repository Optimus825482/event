import { index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { tstz } from "./columns";

/**
 * Kimlik doğrulamasız herkese açık uçların (ör. davetiye sayfası) IP başına hız sınırı sayaçları.
 * Sabit pencere: (kapsam, anahtar, pencere başlangıcı) başına bir satır; sayaç tek bir upsert ile
 * artırılır, böylece birden çok web kopyası aynı sayacı paylaşır. Eski pencereler, istekler sırasında
 * fırsat buldukça silinir (bkz. `lib/rate-limit.ts`). Better Auth'un kendi `rate_limits` tablosundan ayrıdır.
 */
export const publicRateLimits = pgTable(
  "public_rate_limits",
  {
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    windowStart: tstz("window_start").notNull(),
    hits: integer("hits").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.scope, t.key, t.windowStart] }),
    index("public_rate_limits_window_start_idx").on(t.windowStart),
  ],
);
