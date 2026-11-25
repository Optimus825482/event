import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePgConfig } from "../../scripts/pg-config.mjs";

const ROOT = "D:/w/web";

describe("scripts/pg-config.mjs resolvePgConfig", () => {
  it("varsayılanlar bugünküyle aynı", () =>
    expect(resolvePgConfig({}, ROOT)).toEqual({
      dataDir: path.join(ROOT, ".pgdata"),
      port: "54329",
      databases: ["eventflow_dev", "eventflow_test"],
    }));

  it("şerit ayarları", () =>
    expect(
      resolvePgConfig(
        {
          PGDATA_DIR: "D:/PROJELLER/event/web/.pgdata",
          DATABASE_URL: "postgres://postgres@localhost:54329/eventflow_dev_f2_a",
          TEST_DB_NAME: "eventflow_test_f2_a",
        },
        ROOT,
      ),
    ).toEqual({
      dataDir: "D:/PROJELLER/event/web/.pgdata",
      port: "54329",
      databases: ["eventflow_dev_f2_a", "eventflow_test_f2_a"],
    }));

  it("uzak DATABASE_URL geliştirme veritabanını listeye almaz", () =>
    expect(resolvePgConfig({ DATABASE_URL: "postgres://u@db.example:5432/prod" }, ROOT).databases).toEqual(["eventflow_test"]));

  it("önek dışı geliştirme adı reddedilir", () =>
    expect(() => resolvePgConfig({ DATABASE_URL: "postgres://postgres@localhost:54329/postgres" }, ROOT)).toThrow(
      /eventflow_dev önekli/,
    ));

  it("geçersiz TEST_DB_NAME reddedilir", () =>
    expect(() => resolvePgConfig({ TEST_DB_NAME: "eventflow_dev" }, ROOT)).toThrow(/TEST_DB_NAME/));

  it("bağıl PGDATA_DIR reddedilir", () =>
    expect(() => resolvePgConfig({ PGDATA_DIR: "pgdata" }, ROOT)).toThrow(/PGDATA_DIR/));
});
