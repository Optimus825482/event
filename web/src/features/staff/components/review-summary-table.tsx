import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BAND_LABELS } from "@/features/reviews/labels";
import type { StaffReviewSummary } from "@/features/reviews/staff-summary";
import { APP_TIME_ZONE } from "@/lib/time-zone";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: APP_TIME_ZONE });

/** "Değerlendirmeler" sekmesi: kişi başına tamamlanmış değerlendirme özeti (özel notlar yok). */
export function ReviewSummaryTable({ rows }: { rows: StaffReviewSummary[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck />}
        title="Henüz tamamlanmış değerlendirme yok"
        description="Ekip liderleri değerlendirmeleri tamamladıkça personel özeti burada listelenir."
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ad soyad</TableHead>
          <TableHead>Sicil</TableHead>
          <TableHead className="text-right">Değerlendirme</TableHead>
          <TableHead className="text-right">Ortalama puan</TableHead>
          <TableHead>Son değerlendirme</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.staffId}>
            <TableCell>
              <Link href={`/staff/${row.staffId}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                <span aria-hidden className="inline-block size-3 rounded-full" style={{ backgroundColor: row.color ?? "#94a3b8" }} />
                {row.fullName}
              </Link>
            </TableCell>
            <TableCell>{row.sicilNo}</TableCell>
            <TableCell className="text-right">{row.reviewCount}</TableCell>
            <TableCell className="text-right">
              <Badge variant="outline">
                {row.averageScore} · {BAND_LABELS[row.band]}
              </Badge>
            </TableCell>
            <TableCell>{dateFormat.format(new Date(row.lastReviewAt))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
