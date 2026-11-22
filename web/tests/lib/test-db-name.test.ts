import { describe, expect, it } from "vitest";
import { resolveTestDbName, testDatabaseUrl } from "../helpers/db-name";

describe("resolveTestDbName", () => {
  it("tanımsız ya da boş değer için varsayılan adı döner", () => {
    expect(resolveTestDbName(undefined)).toBe("eventflow_test");
    expect(resolveTestDbName("")).toBe("eventflow_test");
  });

  it("eventflow_test önekli adları kabul eder", () => {
    expect(resolveTestDbName("eventflow_test")).toBe("eventflow_test");
    expect(resolveTestDbName("eventflow_test_shell")).toBe("eventflow_test_shell");
    expect(resolveTestDbName("eventflow_test2")).toBe("eventflow_test2");
  });

  it.each([
    "eventflow_dev",
    "postgres",
    "template1",
    "EventFlow_test",
    "eventflow_test-x",
    "eventflow_test x",
    'eventflow_test"; drop database postgres; --',
    "my_eventflow_test",
    `eventflow_test_${"a".repeat(60)}`,
  ])("%s adını bağlanmadan önce reddeder", (name) => {
    expect(() => resolveTestDbName(name)).toThrow(/TEST_DB_NAME/);
  });
});

describe("testDatabaseUrl", () => {
  it("adı bağlantı adresine yerleştirir", () => {
    expect(testDatabaseUrl("eventflow_test_shell")).toBe(
      "postgres://postgres@localhost:54329/eventflow_test_shell",
    );
  });
});
