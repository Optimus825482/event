import * as schema from "@/db/schema";
import { normalizeEmail, normalizePhone } from "@/features/customers/normalize";
import { timestamps } from "./catalogs";
import type { Ctx } from "./context";
import { asUuid, byCreatedThenId, type Row, stableId } from "./values";

/**
 * Müşteriler: telefon/e-posta uygulamadaki `normalize.ts` ile normalize edilir. Normalize
 * telefon ya da e-postası aynı olan kayıtlar (geçişli olarak) tek müşteride birleşir; hayatta
 * kalan en eski kayıttır, rezervasyonlar ve notlar ona yönlendirilir. Birleşmede kaybolacak
 * ek telefon/e-posta değerleri hayatta kalanın `notes` alanına eklenir (raporda değer yazılmaz).
 */

type CustomerRow = typeof schema.customers.$inferInsert & { id: string };

const UNKNOWN_GUEST = "Bilinmeyen misafir";

class UnionFind {
  private readonly parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x) ?? x;
    while (p !== (this.parent.get(p) ?? p)) p = this.parent.get(p) ?? p;
    this.parent.set(x, p);
    return p;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

export type GuestResolution = { customerId: string; kind: "matched" | "created" | "placeholder"; matchedBy: string | null };

export class CustomerDirectory {
  private readonly rows = new Map<string, CustomerRow>();
  private readonly tags = new Map<string, Set<string>>();
  private readonly byPhone = new Map<string, string>();
  private readonly byEmail = new Map<string, string>();
  /** Eski kayıttan türeyen (birleştirilmiş) müşteriler; sayaç farkı yalnızca bunlar için raporlanır. */
  private readonly fromLegacy = new Set<string>();

  constructor(private readonly ctx: Ctx) {}

  get size(): number {
    return this.rows.size;
  }

  load(): void {
    const ctx = this.ctx;
    const legacy = [...ctx.legacy.customers].sort(byCreatedThenId);
    const uf = new UnionFind();
    const keyOwner = new Map<string, string>();
    const norm = new Map<string, { phone: string | null; email: string | null }>();
    for (const r of legacy) {
      const phone = r.trimmed("phone") ? normalizePhone(r.text("phone")) : null;
      const email = r.trimmed("email") ? normalizeEmail(r.text("email")) : null;
      if (r.trimmed("phone") && phone === null) ctx.add("unnormalizableContacts", { table: "customers", id: r.id, field: "phone" });
      if (r.trimmed("email") && email === null) ctx.add("unnormalizableContacts", { table: "customers", id: r.id, field: "email" });
      norm.set(r.id, { phone, email });
      for (const key of [phone && `p:${phone}`, email && `e:${email}`]) {
        if (!key) continue;
        const owner = keyOwner.get(key);
        if (owner) uf.union(owner, r.id);
        else keyOwner.set(key, r.id);
      }
    }
    const groups = new Map<string, Row[]>();
    for (const r of legacy) {
      const root = uf.find(r.id);
      groups.set(root, [...(groups.get(root) ?? []), r]);
    }
    for (const members of groups.values()) this.mergeGroup(members, norm);
  }

  private mergeGroup(members: Row[], norm: Map<string, { phone: string | null; email: string | null }>): void {
    const ctx = this.ctx;
    const [first, ...rest] = members;
    if (!first) return;
    const n = (r: Row) => norm.get(r.id) ?? { phone: null, email: null };
    const withPhone = members.find((m) => n(m).phone !== null);
    const withEmail = members.find((m) => n(m).email !== null);
    const notes: string[] = members.map((m) => m.trimmed("notes")).filter((v): v is string => v !== null);
    const extraPhones = new Set(members.map((m) => n(m).phone).filter((p): p is string => p !== null && p !== n(withPhone ?? first).phone));
    const extraEmails = new Set(members.map((m) => n(m).email).filter((e): e is string => e !== null && e !== n(withEmail ?? first).email));
    if (extraPhones.size > 0) notes.push(`Birleştirilen kayıtlardan ek telefon: ${[...extraPhones].join(", ")}`);
    if (extraEmails.size > 0) notes.push(`Birleştirilen kayıtlardan ek e-posta: ${[...extraEmails].join(", ")}`);
    const sum = (key: string) => members.reduce((acc, m) => acc + (m.int(key) ?? 0), 0);
    const latest = [...members]
      .filter((m) => m.date("lastEventDate") !== null)
      .sort((a, b) => (b.date("lastEventDate")?.getTime() ?? 0) - (a.date("lastEventDate")?.getTime() ?? 0))[0];
    const rawLastEvent = latest?.str("lastEventId") ?? first.str("lastEventId");
    const lastEventId = ctx.resolveEvent(rawLastEvent);
    if (rawLastEvent !== null && rawLastEvent.trim() !== "" && lastEventId === null) {
      ctx.add("orphanReferences", { table: "customers", id: first.id, field: "lastEventId", ref: rawLastEvent, action: "NULL" });
    }
    const createdAt = timestamps(first).createdAt;
    const updatedAt = members.map((m) => timestamps(m).updatedAt).reduce<Date | undefined>((a, b) => (a && b ? (a > b ? a : b) : (a ?? b)), undefined);
    const row: CustomerRow = {
      id: first.id,
      fullName: first.text("fullName").trim() || UNKNOWN_GUEST,
      phone: withPhone?.str("phone") ?? first.str("phone"),
      phoneNormalized: withPhone ? n(withPhone).phone : null,
      email: withEmail?.str("email") ?? first.str("email"),
      emailNormalized: withEmail ? n(withEmail).email : null,
      vipScore: Math.max(...members.map((m) => m.int("vipScore") ?? 0)),
      isBlacklisted: members.some((m) => m.bool("isBlacklisted", false)),
      notes: notes.length > 0 ? notes.join("\n") : null,
      totalSpent: String(sum("totalSpent")),
      eventCount: sum("eventCount"),
      totalAttendedEvents: sum("totalAttendedEvents"),
      totalReservations: sum("totalReservations"),
      noShowCount: sum("noShowCount"),
      lastEventAt: latest?.date("lastEventDate") ?? null,
      lastEventId,
      createdAt,
      updatedAt,
    };
    this.rows.set(row.id, row);
    this.fromLegacy.add(row.id);
    this.tags.set(row.id, new Set(members.flatMap((m) => m.strings("tags").map((t) => t.trim()).filter((t) => t !== ""))));
    for (const m of members) {
      ctx.customerAlias.set(m.id, row.id);
      const { phone, email } = n(m);
      if (phone && !this.byPhone.has(phone)) this.byPhone.set(phone, row.id);
      if (email && !this.byEmail.has(email)) this.byEmail.set(email, row.id);
    }
    if (rest.length > 0) {
      const by = new Set<string>();
      const p0 = members.map((m) => n(m).phone).filter((p) => p !== null);
      const e0 = members.map((m) => n(m).email).filter((e) => e !== null);
      if (new Set(p0).size < p0.length) by.add("phone");
      if (new Set(e0).size < e0.length) by.add("email");
      ctx.add("customerMerges", { survivorId: row.id, mergedIds: rest.map((m) => m.id), matchedBy: [...by].sort() });
    }
  }

  /** Müşterisi olmayan rezervasyon için misafir bilgisinden müşteri bulur ya da oluşturur. */
  forGuest(reservation: Row): GuestResolution {
    const ctx = this.ctx;
    const rawPhone = reservation.trimmed("guestPhone");
    const rawEmail = reservation.trimmed("guestEmail");
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    const email = rawEmail ? normalizeEmail(rawEmail) : null;
    if (rawPhone && phone === null) ctx.add("unnormalizableContacts", { table: "reservations", id: reservation.id, field: "guestPhone" });
    if (rawEmail && email === null) ctx.add("unnormalizableContacts", { table: "reservations", id: reservation.id, field: "guestEmail" });
    const byPhone = phone ? this.byPhone.get(phone) : undefined;
    const byEmail = email ? this.byEmail.get(email) : undefined;
    const found = byPhone ?? byEmail;
    if (found) {
      return { customerId: found, kind: "matched", matchedBy: byPhone ? "phone" : "email" };
    }
    const name = reservation.trimmed("guestName") ?? UNKNOWN_GUEST;
    const identified = phone !== null || email !== null;
    const id = identified ? stableId("customer-from-guest", phone ?? "", email ?? "") : stableId("placeholder-customer", reservation.id);
    this.rows.set(id, {
      id,
      fullName: name,
      phone: rawPhone,
      phoneNormalized: phone,
      email: rawEmail,
      emailNormalized: email,
      createdAt: reservation.date("createdAt") ?? undefined,
      updatedAt: reservation.date("createdAt") ?? undefined,
    });
    if (phone) this.byPhone.set(phone, id);
    if (email) this.byEmail.set(email, id);
    return { customerId: id, kind: identified ? "created" : "placeholder", matchedBy: null };
  }

  /**
   * Sayaçlar taşınan rezervasyon satırlarından yeniden hesaplanır (uygulamanın kuralıyla): iptal
   * edilmeyen rezervasyon sayısı, `no_show` sayısı, `checked_in` sayısı. Eski değerler taşınmaz;
   * çakışma nedeniyle iptal edilen rezervasyonlar ve birleşen müşteriler zaten onları bozardı.
   * Eski değerden farklı olanlar raporlanır. `eventCount`/`totalSpent`/`lastEvent*` rezervasyondan
   * türetilemez, eski değerleriyle kalır.
   */
  recomputeCounters(reservations: ReadonlyArray<{ customerId: string; status?: string }>): void {
    const counts = new Map<string, { total: number; noShow: number; attended: number }>();
    for (const r of reservations) {
      const c = counts.get(r.customerId) ?? { total: 0, noShow: 0, attended: 0 };
      if (r.status !== "cancelled") c.total += 1;
      if (r.status === "no_show") c.noShow += 1;
      if (r.status === "checked_in") c.attended += 1;
      counts.set(r.customerId, c);
    }
    for (const row of this.rows.values()) {
      const c = counts.get(row.id) ?? { total: 0, noShow: 0, attended: 0 };
      const next = { totalReservations: c.total, noShowCount: c.noShow, totalAttendedEvents: c.attended } as const;
      if (this.fromLegacy.has(row.id)) {
        for (const field of ["totalReservations", "noShowCount", "totalAttendedEvents"] as const) {
          if ((row[field] ?? 0) !== next[field]) {
            this.ctx.add("customerCounterChanges", { customerId: row.id, field, legacy: row[field] ?? 0, recomputed: next[field] });
          }
        }
      }
      Object.assign(row, next);
    }
  }

  async flush(): Promise<void> {
    await this.ctx.w.insert(schema.customers, [...this.rows.values()]);
    await this.ctx.w.insert(
      schema.customerTags,
      [...this.tags.entries()].flatMap(([customerId, set]) => [...set].map((tag) => ({ customerId, tag }))),
    );
  }
}

const NOTE_TYPES = new Set<string>(schema.guestNoteType.enumValues);

export async function migrateGuestNotes(ctx: Ctx, extra: (typeof schema.guestNotes.$inferInsert)[]): Promise<void> {
  const rows = ctx.legacy.guest_notes.flatMap((r) => {
    const customerId = ctx.customerAlias.get(r.text("customerId"));
    if (!customerId) {
      ctx.add("skippedRows", { table: "guest_notes", id: r.id, reason: "müşteri yok" });
      return [];
    }
    const createdBy = r.trimmed("createdBy");
    const createdById = ctx.resolveUser(createdBy);
    if (createdBy !== null && createdById === null) {
      ctx.add("orphanReferences", { table: "guest_notes", id: r.id, field: "createdBy", ref: createdBy, action: "NULL" });
    }
    const reservationId = asUuid(r.str("reservationId"));
    const noteType = r.text("noteType", "general");
    return [
      {
        id: r.id,
        customerId,
        eventId: ctx.resolveEvent(r.str("eventId")),
        reservationId: reservationId !== null && ctx.reservationIds.has(reservationId) ? reservationId : null,
        content: r.text("content"),
        noteType: (NOTE_TYPES.has(noteType) ? noteType : "general") as (typeof schema.guestNoteType.enumValues)[number],
        createdById,
        ...timestamps(r),
      },
    ];
  });
  await ctx.w.insert(schema.guestNotes, [...rows, ...extra]);
}
