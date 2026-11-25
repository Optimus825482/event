import { APP_TIME_ZONE } from "@/lib/time-zone";
const formatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

/** ISO metnini sunucu ve istemcide aynı çıkan biçimde gösterir (hidrasyon farkı olmasın). */
export function formatDateTime(iso: string): string {
  return formatter.format(new Date(iso));
}
