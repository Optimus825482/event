import { z } from "zod";

/**
 * Giriş başarı yanıtı; sunucu, saklanan yanıt ve istemci ortak kullanır. Eski saklı yanıtlarda
 * `kind`, `ticketId`, `pnr`, `gate` yoktur: varsayılanlarla okunur.
 */
export const checkInSuccessSchema = z.object({
  outcome: z.enum(["checked_in", "already_checked_in"]),
  kind: z.enum(["reservation", "ticket"]).default("reservation"),
  reservationId: z.string().nullable(),
  ticketId: z.string().nullable().default(null),
  pnr: z.string().nullable().default(null),
  gate: z.number().nullable().default(null),
  eventId: z.string(),
  guestName: z.string().nullable(),
  guestCount: z.number(),
  tableId: z.string(),
  tableLabel: z.string(),
  checkedInAt: z.string(),
  checkedInBy: z.object({ id: z.string(), username: z.string() }).nullable(),
});
export type CheckInSuccess = z.output<typeof checkInSuccessSchema>;
