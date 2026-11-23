import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nonEmptyDomainTables } from "../../../scripts/migrate-legacy/target";
import { createTargetDb, dropDb, uniqueDbName, withClient } from "./harness";

const TARGET = uniqueDbName("eventflow_etl_test", "seeded");

describe("boşluk denetimi ve migration'ın eklediği hazır şablon", () => {
  beforeAll(async () => {
    await createTargetDb(TARGET);
  }, 120_000);
  afterAll(async () => {
    await dropDb(TARGET);
  }, 180_000);

  it("yeni migrate edilmiş hedef, hazır salon şablonuna rağmen boş sayılır", async () => {
    await withClient(TARGET, async (c) => {
      const seeded = await c.query("SELECT 1 FROM venue_templates");
      expect(seeded.rowCount).toBe(1);
      expect(await nonEmptyDomainTables(c)).toEqual([]);
    });
  });

  it("istisna dardır: başka bir şablon ya da sahiplenilmiş hazır şablon hedefi dolu yapar", async () => {
    await withClient(TARGET, async (c) => {
      await c.query("BEGIN");
      await c.query(`INSERT INTO venue_templates (name, layout_data) VALUES ('Başka salon', '{}'::jsonb)`);
      expect(await nonEmptyDomainTables(c)).toEqual(["venue_templates"]);
      await c.query("ROLLBACK");

      await c.query("BEGIN");
      await c.query("INSERT INTO users (id, name, email, username) VALUES (gen_random_uuid(), 'a', 'a@example.invalid', 'a')");
      await c.query("UPDATE venue_templates SET created_by_id = (SELECT id FROM users LIMIT 1)");
      expect(await nonEmptyDomainTables(c)).toEqual(["users", "venue_templates"]);
      await c.query("ROLLBACK");
    });
  });
});
