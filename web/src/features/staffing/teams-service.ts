import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { teamMembers, teams } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { withEventWrite } from "./access";
import { splitKept } from "./diff";
import type { SaveTeamsInput, TeamInput } from "./schemas";

export type SavedTeam = { id: string; name: string };

export const DEFAULT_COLOR = "#3b82f6";

function teamValues(eventId: string, team: TeamInput, index: number) {
  return {
    eventId,
    name: team.name,
    color: team.color ?? DEFAULT_COLOR,
    leaderStaffId: team.leaderStaffId ?? null,
    sortOrder: team.sortOrder ?? index,
    isActive: team.isActive ?? true,
  };
}

/** Bir ekibin üyelerini istenen listeye getirir; kalan üyelerin satırları (kimlikleri) korunur. */
async function syncMembers(tx: Tx, teamId: string, members: TeamInput["members"]): Promise<void> {
  const wanted = members.map((m) => m.staffId);
  await tx
    .delete(teamMembers)
    .where(
      wanted.length > 0
        ? and(eq(teamMembers.teamId, teamId), notInArray(teamMembers.staffId, wanted))
        : eq(teamMembers.teamId, teamId),
    );
  for (const m of members) {
    const values = {
      isLeader: m.isLeader ?? false,
      role: m.role ?? null,
      shiftStart: m.shiftStart ?? null,
      shiftEnd: m.shiftEnd ?? null,
    };
    await tx
      .insert(teamMembers)
      .values({ teamId, staffId: m.staffId, ...values })
      .onConflictDoUpdate({
        target: [teamMembers.teamId, teamMembers.staffId],
        set: { ...values, updatedAt: new Date() },
      });
  }
}

/**
 * Etkinliğin ekiplerini istenen duruma getirir (transaction içinde çağrılır).
 * Bu etkinlikte var olan kimlik güncellenir — böylece `table_groups.team_id` ve atamaların
 * ekip bağı korunur; kimliksiz ya da yeni (istemcinin ürettiği) kimlik eklenir; listede
 * olmayan ekip silinir (FK: grup ve atamadaki bağ boşalır). Başka etkinliğin ekip kimliği
 * birincil anahtar çakışmasıyla reddedilir.
 */
export async function applyTeams(tx: Tx, eventId: string, input: TeamInput[]): Promise<SavedTeam[]> {
  const existing = await tx.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId));
  const { keep, deleteIds } = splitKept(input, existing);
  if (deleteIds.length > 0) await tx.delete(teams).where(inArray(teams.id, deleteIds));

  const saved: SavedTeam[] = [];
  for (const [index, team] of input.entries()) {
    let id: string;
    if (team.id && keep.has(team.id)) {
      await tx
        .update(teams)
        .set({ ...teamValues(eventId, team, index), updatedAt: new Date() })
        .where(eq(teams.id, team.id));
      id = team.id;
    } else {
      const [row] = await tx
        .insert(teams)
        .values({ ...(team.id ? { id: team.id } : {}), ...teamValues(eventId, team, index) })
        .returning({ id: teams.id });
      if (!row) throw new Error("ekip eklenemedi");
      id = row.id;
    }
    await syncMembers(tx, id, team.members);
    saved.push({ id, name: team.name });
  }
  return saved;
}

export async function saveTeams(db: Db | Tx, actor: Actor, input: SaveTeamsInput): Promise<{ teams: SavedTeam[] }> {
  return withEventWrite(db, actor, input.eventId, async (tx) => ({
    teams: await applyTeams(tx, input.eventId, input.teams),
  }));
}
