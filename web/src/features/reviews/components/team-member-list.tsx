"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { LeaderTeamCard } from "../leader-queries";
import { formatDate } from "./leader-ui";

/** "Takımlarım": ekip kartları ve üye arama (eski `leader/team`). */
export function TeamMemberList({ teams }: { teams: LeaderTeamCard[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("tr-TR");

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          type="search"
          aria-label="Üye ara"
          placeholder="Üye ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      {teams.map((team) => {
        const members = team.members.filter(
          (m) => !needle || m.fullName.toLocaleLowerCase("tr-TR").includes(needle) || m.sicilNo.toLocaleLowerCase("tr-TR").includes(needle),
        );
        return (
          <section key={team.id} aria-labelledby={`team-${team.id}`} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id={`team-${team.id}`} className="flex items-center gap-2 text-lg font-semibold text-white">
                <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: team.color }} />
                {team.name}
              </h2>
              <p className="text-sm text-slate-400">
                {team.eventName ? `${team.eventName}${team.eventStartsAt ? ` · ${formatDate(team.eventStartsAt)}` : ""}` : "Genel ekip"} ·{" "}
                {team.members.length} üye
              </p>
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-slate-500">{needle ? "Aramayla eşleşen üye yok." : "Bu ekipte üye yok."}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((m) => (
                  <li key={m.staffId}>
                    <Link
                      href={`/leader/team/${m.staffId}`}
                      className="flex items-center gap-3 rounded-lg border border-slate-700 p-3 transition-colors hover:border-cyan-500/40 hover:bg-slate-800 focus-visible:outline-2"
                    >
                      <span
                        aria-hidden
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-semibold text-cyan-300"
                      >
                        {m.fullName.slice(0, 1).toLocaleUpperCase("tr-TR")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">{m.fullName}</span>
                        <span className="block truncate text-xs text-slate-400">
                          Sicil {m.sicilNo}
                          {m.role ? ` · ${m.role}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
