import { beforeAll, describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { setupTestDb, TEST_DB } from "./helpers/db";

describe("test veritabanı", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  it("select 1 döner", async () => {
    const res = await pool.query<{ one: number }>("select 1 as one");
    expect(res.rows[0]?.one).toBe(1);
  });

  it("oturum saat dilimi UTC'dir", async () => {
    const res = await pool.query<{ TimeZone: string }>("select current_setting('TimeZone') as \"TimeZone\"");
    expect(res.rows[0]?.TimeZone).toBe("UTC");
  });

  it("test veritabanına bağlıdır", async () => {
    const res = await pool.query<{ db: string }>("select current_database() as db");
    expect(res.rows[0]?.db).toBe(TEST_DB);
  });
});
