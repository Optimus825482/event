import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CustomerList } from "../queries";

type Props = { list: CustomerList; basePath: string; q: string | undefined; showReservations: boolean };

function pageHref(basePath: string, q: string | undefined, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Arama formu: düz GET, istemci kodu gerektirmez. */
export function SearchForm({ basePath, q }: { basePath: string; q: string | undefined }) {
  return (
    <form action={basePath} method="get" role="search" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Ad, telefon veya e-posta ara"
        aria-label="Müşteri ara"
        className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button type="submit" className={buttonVariants({ variant: "secondary" })}>
        Ara
      </button>
    </form>
  );
}

export function CustomerList({ list, basePath, q, showReservations }: Props) {
  if (list.items.length === 0) {
    return (
      <p className="rounded-(--radius) border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {q ? "Aramanızla eşleşen müşteri bulunamadı." : "Henüz müşteri yok."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ad soyad</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>E-posta</TableHead>
            <TableHead>Etiketler</TableHead>
            {showReservations ? <TableHead className="text-right">Rezervasyon</TableHead> : null}
            <TableHead className="text-right">Not</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.items.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                <Link href={`/customers/${c.id}`} className="hover:underline">
                  {c.fullName}
                </Link>
                {c.isBlacklisted ? (
                  <Badge variant="destructive" className="ml-2">
                    Kara liste
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>{c.phone ?? "-"}</TableCell>
              <TableCell>{c.email ?? "-"}</TableCell>
              <TableCell>
                <span className="flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </span>
              </TableCell>
              {showReservations ? <TableCell className="text-right">{c.reservationCount}</TableCell> : null}
              <TableCell className="text-right">{c.noteCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <nav aria-label="Sayfalama" className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {list.total} müşteri, sayfa {list.page}/{list.totalPages}
        </span>
        <span className="flex gap-2">
          {list.page > 1 ? (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={pageHref(basePath, q, list.page - 1)}>
              Önceki
            </Link>
          ) : null}
          {list.page < list.totalPages ? (
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={pageHref(basePath, q, list.page + 1)}>
              Sonraki
            </Link>
          ) : null}
        </span>
      </nav>
    </div>
  );
}
