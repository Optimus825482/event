import { cn } from "@/lib/utils";
import { tagStyle } from "../vip";

/** Etiket çipleri (eski palet: VIP sarı, Vegan yeşil, Sahne Önü mor, Bahşiş mavi, Dikkat kırmızı). */
export function TagChips({ tags, className }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => {
        const style = tagStyle(tag);
        return (
          <span key={tag} className={cn("rounded border px-2 py-0.5 text-xs font-medium", style.className)}>
            {style.label}
          </span>
        );
      })}
    </span>
  );
}
