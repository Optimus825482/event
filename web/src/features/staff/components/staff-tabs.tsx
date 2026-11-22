import Link from "next/link";
import { cn } from "@/lib/utils";

export type StaffTabKey = "people" | "teams" | "reviews";

const TAB_LABELS: Record<StaffTabKey, string> = { people: "Personel", teams: "Ekipler", reviews: "Değerlendirmeler" };

/** Sekmeler URL'de (`?tab=`) tutulur; her sekme sunucuda kendi verisini yükler. */
export function StaffTabs({ active, available }: { active: StaffTabKey; available: readonly StaffTabKey[] }) {
  return (
    <nav aria-label="Personel modülleri" className="mb-6 flex flex-wrap gap-2 border-b border-slate-700">
      {available.map((key) => (
        <Link
          key={key}
          href={key === "people" ? "/staff" : `/staff?tab=${key}`}
          aria-current={active === key ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-4 py-2 text-sm transition-colors focus-visible:outline-2",
            active === key
              ? "border-blue-500 font-medium text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200",
          )}
        >
          {TAB_LABELS[key]}
        </Link>
      ))}
    </nav>
  );
}
