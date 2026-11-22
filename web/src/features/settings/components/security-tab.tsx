"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SecurityOverview } from "../security-queries";
import type { SecurityPolicy } from "../security-policy";
import { SecurityLockouts } from "./security-tab-lockouts";
import { SecuritySessions } from "./security-tab-sessions";

function policyItems(policy: SecurityPolicy): [string, string][] {
  return [
    ["Asgari parola uzunluğu", `${policy.minPasswordLength} karakter`],
    ["Parola özeti (bcrypt) maliyeti", String(policy.bcryptCost)],
    ["Oturum ömrü", policy.sessionDays === null ? "—" : `${policy.sessionDays} gün`],
    ["Giriş kilidi: kullanıcı adı + IP", `${policy.maxAttemptsPerIp} deneme`],
    ["Giriş kilidi: kullanıcı adı (tüm IP'ler)", `${policy.maxAttemptsAllIps} deneme`],
    ["Giriş kilidi penceresi", `${policy.windowMinutes} dakika`],
  ];
}

/** Güvenlik sekmesi: salt okunur politika özeti, etkin oturumlar ve giriş kilitleri. */
export function SecurityTab({ overview }: { overview: SecurityOverview }) {
  return (
    <div className="space-y-6">
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle>Güvenlik politikası</CardTitle>
          <CardDescription>Sistem tarafından uygulanan değerler (salt okunur)</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {policyItems(overview.policy).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="mt-1 text-sm font-medium text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <SecuritySessions sessions={overview.sessions} />
      <SecurityLockouts lockouts={overview.lockouts} windowMinutes={overview.policy.windowMinutes} />
    </div>
  );
}
