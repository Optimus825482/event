import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { PeriodForm } from "@/features/reports/components/period-form";
import { PeriodTable } from "@/features/reports/components/period-table";
import { defaultPeriod, periodSchema } from "@/features/reports/period";
import { getPeriodReport } from "@/features/reports/service";

export const metadata: Metadata = { title: "Raporlar | EventFlow" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePolicyActor();
  const params = await searchParams;
  const fallback = defaultPeriod(new Date());
  const input = { from: first(params.from)?.trim() || fallback.from, to: first(params.to)?.trim() || fallback.to };
  const parsed = periodSchema.safeParse(input);
  const report = parsed.success ? await getPeriodReport(db, actor, parsed.data) : null;
  const errors = parsed.success ? [] : [...new Set(parsed.error.issues.map((i) => i.message))];
  const exportHref = `/reports/export?${new URLSearchParams({ from: input.from, to: input.to }).toString()}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Raporlar"
        description="Dönem raporu (etkinlik tarihine göre)"
        icon={<BarChart3 className="size-8 text-blue-400" aria-hidden />}
        actions={
          report ? (
            <a className={buttonVariants({ variant: "secondary" })} href={exportHref}>
              Excel&apos;e aktar
            </a>
          ) : null
        }
      />
      <PeriodForm from={input.from} to={input.to} />
      {errors.length > 0 ? (
        <div role="alert" className="rounded-lg border border-red-700 p-3 text-sm text-red-800 dark:border-red-300 dark:text-red-200">
          {errors.join(" ")}
        </div>
      ) : null}
      {report ? <PeriodTable report={report} /> : null}
    </div>
  );
}
