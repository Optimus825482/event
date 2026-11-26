import { Bell, Building2, Calendar, CheckCircle2, Clock, Settings, Shield, Ticket, UserCog, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadAdminDashboard } from "@/features/dashboard/queries";

export const metadata: Metadata = { title: "Sistem Yönetimi | EventFlow" };

type AdminCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  iconBg: string;
  hover: string;
  children?: ReactNode;
  href: string;
  action: string;
  actionClass: string;
};

function AdminCard({ title, description, icon, iconBg, hover, children, href, action, actionClass }: AdminCardProps) {
  return (
    <section className={`flex flex-col rounded-xl border border-slate-700 bg-slate-800 p-6 transition-colors ${hover}`}>
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold text-white">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>
        {title}
      </h2>
      <p className="mb-4 text-sm text-slate-400">{description}</p>
      <div className="mb-4 flex-1 space-y-2">{children}</div>
      <Link href={href} className={cn(buttonVariants(), "w-full", actionClass)}>
        {action}
      </Link>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

function Status({ ok, children }: { ok: boolean; children: ReactNode }) {
  const Icon = ok ? CheckCircle2 : Clock;
  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <Icon aria-hidden="true" className={`h-4 w-4 ${ok ? "text-green-400" : "text-amber-400"}`} />
      {children}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const data = await loadAdminDashboard();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Sistem Yönetimi"
        description="Kullanıcı yönetimi, sistem ayarları ve raporlar"
        icon={<Shield aria-hidden="true" className="h-6 w-6 text-amber-400" />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Toplam Kullanıcı"
          value={data.users.total}
          tone="blue"
          icon={<Users aria-hidden="true" className="h-6 w-6" />}
          hint={`${data.users.active} aktif · ${data.users.admins} admin`}
        />
        <StatCard
          label="Toplam Etkinlik"
          value={data.events.total}
          tone="purple"
          icon={<Calendar aria-hidden="true" className="h-6 w-6" />}
          hint={`${data.events.upcoming} yaklaşan etkinlik`}
        />
        <StatCard
          label="Toplam Rezervasyon"
          value={data.reservations.total}
          tone="emerald"
          icon={<Ticket aria-hidden="true" className="h-6 w-6" />}
          hint={`Bugün: ${data.reservations.today}`}
        />
        <StatCard
          label="Aktif Ekip"
          value={data.teams.active}
          tone="blue"
          icon={<Users aria-hidden="true" className="h-6 w-6" />}
          hint={`Toplam: ${data.teams.total}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AdminCard
          title="Kullanıcı Yönetimi"
          description="Kullanıcı hesaplarını yönetin, roller atayın ve erişim izinlerini düzenleyin."
          icon={<UserCog aria-hidden="true" className="h-5 w-5 text-blue-400" />}
          iconBg="bg-blue-600/20"
          hover="hover:border-blue-500/50"
          href="/admin/users"
          action="Kullanıcıları Yönet"
          actionClass="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Row label="Bu ay yeni kayıt" value={`+${data.users.newThisMonth}`} />
        </AdminCard>

        <AdminCard
          title="Sistem Ayarları"
          description="Genel sistem ayarları, e-posta yapılandırması ve entegrasyonlar."
          icon={<Settings aria-hidden="true" className="h-5 w-5 text-amber-400" />}
          iconBg="bg-amber-600/20"
          hover="hover:border-amber-500/50"
          href="/admin/settings"
          action="Ayarları Düzenle"
          actionClass="bg-amber-600 text-white hover:bg-amber-700"
        >
          <Status ok={data.settings.smtpConfigured}>
            SMTP {data.settings.smtpConfigured ? "yapılandırıldı" : "yapılandırılmadı"}
          </Status>
          <Status ok={data.settings.emailNotifications}>
            E-posta bildirimleri {data.settings.emailNotifications ? "aktif" : "kapalı"}
          </Status>
        </AdminCard>

        <AdminCard
          title="Bildirimler"
          description="Sistem bildirimlerini görüntüle, takip et ve yönet."
          icon={<Bell aria-hidden="true" className="h-5 w-5 text-purple-400" />}
          iconBg="bg-purple-600/20"
          hover="hover:border-purple-500/50"
          href="/notifications"
          action="Bildirimleri Görüntüle"
          actionClass="border border-purple-500/30 bg-transparent text-purple-400 hover:bg-purple-500/10"
        >
          <Row label="Bu ay etkinlik" value={data.events.thisMonth} />
          <Row label="Bugün oluşturulan" value={data.events.today} />
        </AdminCard>

        <AdminCard
          title="Organizasyon Yönetimi"
          description="Bölümler, unvanlar ve görev yerlerini yönetin. Departman ilişkilerini düzenleyin."
          icon={<Building2 aria-hidden="true" className="h-5 w-5 text-emerald-400" />}
          iconBg="bg-emerald-600/20"
          hover="hover:border-emerald-500/50"
          href="/settings/organization"
          action="Organizasyonu Yönet"
          actionClass="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Status ok>Bölümler &amp; Pozisyonlar</Status>
          <Status ok>Görev Yerleri</Status>
        </AdminCard>
      </div>
    </div>
  );
}
