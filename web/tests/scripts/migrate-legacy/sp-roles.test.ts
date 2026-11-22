import { describe, expect, it } from "vitest";
import { allowedRolesWithUsed } from "../../../scripts/migrate-legacy/events";

describe("ETL: servis noktası izinli rolleri", () => {
  it("boş liste (her rol serbest) olduğu gibi kalır", () => {
    expect(allowedRolesWithUsed([], ["barmen", null])).toEqual({ roles: [], added: [] });
  });

  it("atamada kullanılan ama listede olmayan rol eklenir; büyük/küçük harf ve tekrar yok sayılır", () => {
    expect(allowedRolesWithUsed(["barman", "garson"], ["Garson", " hostes ", "hostes", null, ""])).toEqual({
      roles: ["barman", "garson", "hostes"],
      added: ["hostes"],
    });
  });
});
