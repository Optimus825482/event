import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import * as schema from "@/db/schema";

export const pool: Pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  options: "-c timezone=UTC",
});

export const db = drizzle(pool, { schema });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
