import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { derivedTestDbName } from "../helpers/db-name";
import { localTestDbName, pickLocalEnv } from "../helpers/local-env";

const dirs: string[] = [];
function tempDir(envText?: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "local-env-"));
  dirs.push(dir);
  if (envText !== undefined) writeFileSync(path.join(dir, ".env.local"), envText);
  return dir;
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("pickLocalEnv", () => {
  it("yalnızca istenen anahtarlar alınır", () =>
    expect(
      pickLocalEnv('# yorum\nDATABASE_URL=x\nTEST_DB_NAME="eventflow_test_f3_b"\nBETTER_AUTH_SECRET=gizli\n', ["TEST_DB_NAME"]),
    ).toEqual({ TEST_DB_NAME: "eventflow_test_f3_b" }));

  it("tek tırnak, boş satır, CRLF ve yorum satırı", () =>
    expect(pickLocalEnv("\r\n# A=1\r\nA='iki'\r\n\r\nB=üç\r\n", ["A", "B"])).toEqual({ A: "iki", B: "üç" }));
});

describe("localTestDbName", () => {
  it("süreç ortamı dosyadan önce gelir", () =>
    expect(localTestDbName({ TEST_DB_NAME: "eventflow_test_x" }, tempDir("TEST_DB_NAME=eventflow_test_dosya\n"))).toBe(
      "eventflow_test_x",
    ));

  it("ortamda yoksa dosyadan okunur", () =>
    expect(localTestDbName({}, tempDir("BETTER_AUTH_SECRET=gizli\nTEST_DB_NAME=eventflow_test_dosya\n"))).toBe(
      "eventflow_test_dosya",
    ));

  it("dosya yoksa undefined", () => expect(localTestDbName({}, path.join(tmpdir(), "yok-boyle-bir-dizin-xyz"))).toBeUndefined());

  it("dosyada anahtar yoksa undefined", () => expect(localTestDbName({}, tempDir("A=1\n"))).toBeUndefined());
});

describe("derivedTestDbName", () => {
  it("birleştirir ve sınırları denetler", () => {
    expect(derivedTestDbName("eventflow_test_f2_a", "mig")).toBe("eventflow_test_f2_a_mig");
    expect(() => derivedTestDbName(`eventflow_test_${"a".repeat(46)}`, "mig")).toThrow(/TEST_DB_NAME/);
  });
});
