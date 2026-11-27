import { z } from "zod";
import { SIGHTLINE_SETS, type SightlineSet } from "@/features/sales-api/contract";
import { zonedWallClockToDate } from "@/lib/time-zone";
import { IMAGE_SLOTS } from "./image-status";

function optionalText(max: number, tooLongMessage: string) {
  return z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      const t = v?.trim() ?? "";
      return t.length > 0 ? t : null;
    })
    .refine((v) => v === null || v.length <= max, tooLongMessage);
}

const optionalDoorsOpenAt = z
  .union([z.date(), z.string(), z.null()])
  .optional()
  .transform((val, ctx): Date | null => {
    if (val === undefined || val === null) return null;
    if (val instanceof Date) {
      if (Number.isNaN(val.getTime())) {
        ctx.addIssue({ code: "custom", message: "Geçersiz tarih" });
        return z.NEVER;
      }
      return val;
    }
    const trimmed = val.trim();
    if (trimmed === "") return null;
    const parsed = zonedWallClockToDate(trimmed);
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "Geçersiz tarih" });
      return z.NEVER;
    }
    return parsed;
  });

const optionalSightlineSet = z
  .string()
  .nullable()
  .optional()
  .transform((val, ctx): SightlineSet | null => {
    const trimmed = val?.trim() ?? "";
    if (trimmed === "") return null;
    if ((SIGHTLINE_SETS as readonly string[]).includes(trimmed)) {
      return trimmed as SightlineSet;
    }
    ctx.addIssue({ code: "custom", message: "Geçersiz sahne görüşü seti" });
    return z.NEVER;
  });

export const saveSiteContentSchema = z.object({
  eventId: z.uuid(),
  summary: optionalText(2000, "Tanıtım metni en fazla 2000 karakter olabilir"),
  doorsOpenAt: optionalDoorsOpenAt,
  ageLimit: optionalText(40, "Yaş sınırı en fazla 40 karakter olabilir"),
  dressCode: optionalText(80, "Kıyafet en fazla 80 karakter olabilir"),
  sightlineSet: optionalSightlineSet,
});

export type SaveSiteContentInput = z.infer<typeof saveSiteContentSchema>;

export const siteImageSchema = z.object({
  eventId: z.uuid(),
  slot: z.enum(IMAGE_SLOTS),
});

export type SiteImageInput = z.infer<typeof siteImageSchema>;
