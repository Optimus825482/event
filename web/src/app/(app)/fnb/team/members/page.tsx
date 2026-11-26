import type { Metadata } from "next";
import { Users, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { LeaderNoAccess, LeaderStat } from "@/features/reviews/components/leader-ui";
import { TeamMemberList } from "@/features/reviews/components/team-member-list";
import { listLeaderTeams } from "@/features/reviews/leader-queries";
import { canUseLeaderPanel } from "@/features/reviews/leader-scope";

export const metadata: Metadata = { title: "Ekip | Lider | EventFlow" };

export default async function LeaderTeamPage() {
  const actor = await requirePolicyActor();
  if (!canUseLeaderPanel(actor)) return <LeaderNoAccess />;
  const teams = await listLeaderTeams(db, actor);
  const memberCount = new Set(teams.flatMap((t) => t.members.map((m) => m.staffId))).size;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Ekip" description="Takımlarınız ve ekip üyeleriniz" />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
        <LeaderStat label="Takım" value={teams.length} icon={<UsersRound className="size-5" />} />
        <LeaderStat label="Toplam Üye" value={memberCount} icon={<Users className="size-5" />} />
      </div>
      {teams.length === 0 ? (
        <EmptyState
          icon={<UsersRound />}
          title="Gösterilecek ekip yok"
          description="Ekip lideri olduğunuz ekipler burada listelenir. Süpervizör ya da kısım sorumlusuysanız değerlendireceğiniz personele etkinlik sayfasından ulaşabilirsiniz."
        />
      ) : (
        <>
          <h2 className="mb-3 text-lg font-semibold text-white">Takımlarım</h2>
          <TeamMemberList teams={teams} />
        </>
      )}
    </div>
  );
}
