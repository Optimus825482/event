import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Dönem seçimi: GET formu (sunucu bileşeni; adres paylaşılabilir). */
export function PeriodForm({ from, to }: { from: string; to: string }) {
  return (
    <form action="/reports" method="get" className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="period-from">Başlangıç</Label>
        <Input id="period-from" type="date" name="from" defaultValue={from} className="border-slate-500" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="period-to">Bitiş</Label>
        <Input id="period-to" type="date" name="to" defaultValue={to} className="border-slate-500" />
      </div>
      <Button type="submit">Raporu getir</Button>
    </form>
  );
}
