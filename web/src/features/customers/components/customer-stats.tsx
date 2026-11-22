import { Ban, Crown, TicketCheck, Users } from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import type { CustomerStats } from "../queries";

/** CRM ve VIP analizi başlığı (eski müşteri sayfası): toplam, VIP, kara liste, katılım. */
export function CustomerStatsHeader({ stats }: { stats: CustomerStats }) {
  return (
    <section aria-label="CRM ve VIP analizi" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard tone="blue" icon={<Users className="size-5" />} value={stats.total} label="Toplam Müşteri" />
      <StatCard tone="amber" icon={<Crown className="size-5" />} value={stats.vip} label="VIP Müşteri" />
      <StatCard tone="red" icon={<Ban className="size-5" />} value={stats.blacklisted} label="Kara Liste" />
      <StatCard tone="emerald" icon={<TicketCheck className="size-5" />} value={stats.attended} label="Toplam Katılım" />
    </section>
  );
}
