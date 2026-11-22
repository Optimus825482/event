import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { departments, positions, staff, workLocations } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { STAFF_IMPORT_MAX_BYTES } from "@/features/staff/csv-import";
import { staffImportActionDefs } from "@/features/staff/import-action-defs";
import { decodeCsv, importStaffCsv, previewStaffImport } from "@/features/staff/import-service";
import { createAction } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import { createStaff, createUser } from "../../helpers/factories";

function actorOf(role: Role): Actor {
  return { id: "00000000-0000-4000-8000-000000000001", username: "t", role, staffId: null };
}
const admin = actorOf("admin");

function bytes(text: string): { bytes: Uint8Array } {
  return { bytes: new TextEncoder().encode(text) };
}

const HEADER = "Sicil No;İsim Soyisim;Unvan;Çalıştığı Bölüm;Görev Yeri;Cinsiyet;Doğum Tarihi;Durum;Ayrılma Tarihi;Ayrılma Nedeni";

async function seedCatalogs() {
  await db.insert(departments).values([{ name: "Servis" }, { name: "Mutfak" }, { name: "Eski Bölüm", isActive: false }]);
  await db.insert(positions).values([{ name: "Garson" }, { name: "Aşçı" }]);
  await db.insert(workLocations).values([{ name: "Ana Salon" }]);
}

describe("personel CSV içe aktarma", () => {
  beforeEach(async () => {
    await truncateAll();
    await seedCatalogs();
  });

  it("önizleme yazmaz; katalog adları Türkçe duyarsız eşlenir, hatalar satır başına raporlanır", async () => {
    await createStaff(db, { sicilNo: "1003" });
    const csv = [
      HEADER,
      "1001;Ahmet Yılmaz;garson;SERVİS;ana salon;Erkek;15 Ocak 1990;;;",
      "1002;Ayşe Kaya;Aşçı;Bilinmeyen;;Kadın;31.02.1990;;;",
      "1003;Var Olan;;;;;;;;",
      ";Sicilsiz;;;;;;;;",
      "1001;Yinelenen;;;;;;;;",
      "1004;Eski;;Eski Bölüm;;;;;;",
    ].join("\n");

    const preview = await previewStaffImport(db, admin, bytes(csv));
    expect(await db.select().from(staff)).toHaveLength(1);
    expect(preview).toMatchObject({ okCount: 1, errorCount: 3, duplicateCount: 2, ignoredColumns: [] });
    const byLine = new Map(preview.rows.map((r) => [r.line, r]));
    expect(byLine.get(2)).toMatchObject({ status: "ok", sicilNo: "1001" });
    expect(byLine.get(3)?.status).toBe("error");
    expect(byLine.get(3)?.messages.join(" ")).toMatch(/Çalıştığı Bölüm: “Bilinmeyen” bulunamadı/);
    expect(byLine.get(3)?.messages.join(" ")).toMatch(/Doğum Tarihi: geçersiz tarih/);
    expect(byLine.get(4)).toMatchObject({ status: "duplicate", messages: [expect.stringContaining("zaten kayıtlı")] });
    expect(byLine.get(5)?.messages.join(" ")).toMatch(/Sicil No: Bu alan zorunludur/);
    expect(byLine.get(6)).toMatchObject({ status: "duplicate", messages: [expect.stringContaining("2. satırda")] });
    // Pasif katalog kaydına bağlanmaz.
    expect(byLine.get(7)?.status).toBe("error");
  });

  it("geçerli satırları tek işlemde ekler; mevcut servis kuralları (renk, kimlikler, durum) uygulanır", async () => {
    await createStaff(db, { sicilNo: "9999" });
    const csv = [
      HEADER,
      "1001;Ahmet Yılmaz;Garson;Servis;Ana Salon;Erkek;15 Ocak 1990;Çalışıyor;;",
      "1002;Çağrı Öztürk;Aşçı;Mutfak;;;;Ayrıldı;01.06.2024;Taşındı",
      "1003;Pasif Kişi;;;;;;Pasif;;",
      "9999;Var Olan;;;;;;;;",
      "1004;Hatalı;;;;Belki;;;;",
    ].join("\r\n");

    const result = await importStaffCsv(db, admin, bytes(`﻿${csv}\r\n`));
    expect(result).toMatchObject({ createdCount: 3, duplicateCount: 1, errorCount: 1 });
    expect(result.rows.map((r) => r.status)).toEqual(["created", "created", "created", "duplicate", "error"]);

    const rows = await db.select().from(staff).orderBy(asc(staff.sicilNo));
    expect(rows.map((r) => r.sicilNo)).toEqual(["1001", "1002", "1003", "9999"]);
    const [dep] = await db.select().from(departments).where(eq(departments.name, "Servis"));
    const ahmet = rows.find((r) => r.sicilNo === "1001");
    expect(ahmet).toMatchObject({ fullName: "Ahmet Yılmaz", departmentId: dep?.id, gender: "male", birthDate: "1990-01-15", status: "active" });
    expect(ahmet?.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(rows.find((r) => r.sicilNo === "1002")).toMatchObject({
      status: "terminated",
      terminationDate: "2024-06-01",
      terminationReason: "Taşındı",
    });
    expect(rows.find((r) => r.sicilNo === "1003")?.status).toBe("inactive");
  });

  it("ayrılma bilgisi yalnızca Ayrıldı durumunda kabul edilir", async () => {
    const preview = await previewStaffImport(db, admin, bytes(`${HEADER}\n1;Ali;;;;;;Çalışıyor;01.01.2024;`));
    expect(preview.rows[0]?.status).toBe("error");
  });

  it("geçerli satır yoksa hiçbir şey yazılmaz", async () => {
    const result = await importStaffCsv(db, admin, bytes(`${HEADER}\n;Sicilsiz;;;;;;;;`));
    expect(result.createdCount).toBe(0);
    expect(await db.select().from(staff)).toHaveLength(0);
  });

  it("dosya düzeyi hatalar invalid DomainError olur", async () => {
    await expect(previewStaffImport(db, admin, bytes("Ad;Soyad\nA;B"))).rejects.toMatchObject({ code: "invalid" });
    await expect(previewStaffImport(db, admin, bytes('Sicil No;İsim Soyisim\n1;"açık'))).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining("tırnak") as string,
    });
    // Latin-5 (Windows-1254) "ş" baytı: UTF-8 değil, sessizce bozulmaz.
    const latin5 = new Uint8Array([...new TextEncoder().encode("Sicil No;İsim Soyisim\n1;Ay"), 0xfe, 0x65]);
    await expect(previewStaffImport(db, admin, { bytes: latin5 })).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining("UTF-8") as string,
    });
    expect(() => decodeCsv(new Uint8Array(STAFF_IMPORT_MAX_BYTES + 1))).toThrow(/MB/);
  });

  it("pasif/ayrıldı durumu düzenleme yetkisi ister; yetkisiz roller içe aktaramaz", async () => {
    for (const role of ["staff", "leader", "controller", "venue_owner"] as const) {
      await expect(previewStaffImport(db, actorOf(role), bytes(`${HEADER}\n1;Ali;;;;;;;;`))).rejects.toBeInstanceOf(ForbiddenError);
      await expect(importStaffCsv(db, actorOf(role), bytes(`${HEADER}\n1;Ali;;;;;;;;`))).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.select().from(staff)).toHaveLength(0);
  });

  it("action: FormData ile önizler ve içe aktarır; dosya yok/büyük/yetkisiz/oturumsuz durumları", async () => {
    const user = await createUser(db, { role: "organizer" });
    const organizer: Actor = { id: user.id, username: user.username, role: "organizer", staffId: null };
    const { defineAction } = createAction({ getActor: async () => organizer });
    const preview = defineAction(staffImportActionDefs.preview);
    const run = defineAction(staffImportActionDefs.run);
    const form = (content: BlobPart, name = "personel.csv") => {
      const data = new FormData();
      data.set("file", new File([content], name, { type: "text/csv" }));
      return data;
    };

    expect(await preview(form(`${HEADER}\n1;Ali;;;;;;;;`))).toMatchObject({ ok: true, data: { okCount: 1 } });
    expect(await db.select().from(staff)).toHaveLength(0);
    expect(await run(form(`${HEADER}\n1;Ali;;;;;;;;`))).toMatchObject({ ok: true, data: { createdCount: 1 } });
    expect(await db.select().from(staff)).toHaveLength(1);

    const missing = await run({});
    expect(missing).toMatchObject({ ok: false, code: "invalid" });
    expect(await run(form(new Uint8Array(STAFF_IMPORT_MAX_BYTES + 1)))).toMatchObject({
      ok: false,
      code: "invalid",
      message: expect.stringContaining("MB") as string,
    });

    const staffUser = await createUser(db, { role: "staff" });
    const denied = createAction({
      getActor: async () => ({ id: staffUser.id, username: staffUser.username, role: "staff", staffId: null }),
    }).defineAction(staffImportActionDefs.run);
    expect(await denied(form(`${HEADER}\n2;Veli;;;;;;;;`))).toMatchObject({ ok: false, code: "forbidden" });

    const anon = createAction({ getActor: async () => null }).defineAction(staffImportActionDefs.preview);
    expect(await anon(form(`${HEADER}\n2;Veli;;;;;;;;`))).toMatchObject({ ok: false, code: "unauthenticated" });
  });
});
