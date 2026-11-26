import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertDestructiveAllowed,
  assertLaneClusterExists,
  resolveClusterDir,
  resolveDatabaseNames,
  resolvePgConfig,
} from "../../scripts/pg-config.mjs";

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

describe("I1: şerit varsayılan adlarla yıkıcı komut çalıştıramaz", () => {
  const LANE = "D:/PROJELLER/event/web/.pgdata";
  it("şeritte (PGDATA_DIR var) çıplak varsayılan adlar reddedilir", () => {
    expect(() => assertDestructiveAllowed({ PGDATA_DIR: LANE }, resolveDatabaseNames({ PGDATA_DIR: LANE }))).toThrow(
      /eventflow_dev, eventflow_test/,
    );
  });
  it("yalnızca DATABASE_URL satırı eksikse de reddedilir", () => {
    const env = { PGDATA_DIR: LANE, TEST_DB_NAME: "eventflow_test_f2_a" };
    expect(() => assertDestructiveAllowed(env, resolveDatabaseNames(env))).toThrow(/eventflow_dev/);
  });
  it("yalnızca TEST_DB_NAME satırı eksikse de reddedilir", () => {
    const env = { PGDATA_DIR: LANE, DATABASE_URL: "postgres://postgres@localhost:54329/eventflow_dev_f2_a" };
    expect(() => assertDestructiveAllowed(env, resolveDatabaseNames(env))).toThrow(/eventflow_test/);
  });
  it("uzak DATABASE_URL olan şeritte çıplak test adı yine reddedilir", () => {
    const env = { PGDATA_DIR: LANE, DATABASE_URL: "postgres://u@db.example:5432/x" };
    expect(() => assertDestructiveAllowed(env, resolveDatabaseNames(env))).toThrow(/eventflow_test/);
  });
  it("şerit adları geçer", () => {
    const env = {
      PGDATA_DIR: LANE,
      DATABASE_URL: "postgres://postgres@localhost:54329/eventflow_dev_a",
      TEST_DB_NAME: "eventflow_test_a",
    };
    expect(() => assertDestructiveAllowed(env, resolveDatabaseNames(env))).not.toThrow();
  });
  it("ana ağaç (PGDATA_DIR yok) bugünkü gibi varsayılanlarla izinli", () => {
    expect(() => assertDestructiveAllowed({}, resolveDatabaseNames({}))).not.toThrow();
  });
});

describe("I2: adlar yalnızca gereken yerde çözülür", () => {
  const BAD = { DATABASE_URL: "postgres://postgres@localhost:54329/postgres", TEST_DB_NAME: "eventflow_dev" };
  it("küme dizini çözümü veritabanı adlarına bakmaz (stop / start dizin yolu)", () => {
    expect(resolveClusterDir(BAD, ROOT).dataDir).toBe(path.join(ROOT, ".pgdata"));
  });
  it("ad çözümü geçersiz girdide hata verir (yalnızca reset / drop-test / ensureDatabases çağırır)", () => {
    expect(() => resolveDatabaseNames(BAD)).toThrow();
  });
});

describe("I3: PGDATA_DIR doğrulaması", () => {
  it("win32'de Git Bash biçimli yol reddedilir", () => {
    expect(() => resolveClusterDir({ PGDATA_DIR: "/d/PROJELLER/event/web/.pgdata" }, ROOT, { platform: "win32" })).toThrow(
      /sürücü harfi/,
    );
  });
  it("win32'de sürücü harfli yol (düz ya da ters eğik çizgi) kabul edilir", () => {
    expect(resolveClusterDir({ PGDATA_DIR: "D:/x/.pgdata" }, ROOT, { platform: "win32" }).dataDir).toBe("D:/x/.pgdata");
    expect(resolveClusterDir({ PGDATA_DIR: "D:\\x\\.pgdata" }, ROOT, { platform: "win32" }).lane).toBe(true);
  });
  it("win32 dışında mutlak POSIX yolu kabul edilir", () => {
    expect(resolveClusterDir({ PGDATA_DIR: "/srv/pg" }, ROOT, { platform: "linux" }).dataDir).toBe("/srv/pg");
  });
  it("PGDATA_DIR yoksa lane=false", () => {
    expect(resolveClusterDir({}, ROOT, { platform: "win32" }).lane).toBe(false);
  });
  it("şeritte PG_VERSION yoksa reddedilir ve küme kurulmaz", () => {
    const cluster = resolveClusterDir({ PGDATA_DIR: "D:/x/.pgdata" }, ROOT, { platform: "win32" });
    expect(() => assertLaneClusterExists(cluster, () => false)).toThrow(/PG_VERSION/);
  });
  it("PG_VERSION varsa kabul edilir; ana ağaç denetlenmez", () => {
    const cluster = resolveClusterDir({ PGDATA_DIR: "D:/x/.pgdata" }, ROOT, { platform: "win32" });
    expect(() =>
      assertLaneClusterExists(cluster, (p: import("node:fs").PathLike) => String(p).replace(/\\/g, "/").endsWith("/.pgdata/PG_VERSION")),
    ).not.toThrow();
    expect(() => assertLaneClusterExists(resolveClusterDir({}, ROOT), () => false)).not.toThrow();
  });
});
