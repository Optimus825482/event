import { cn } from "@/lib/cn";

type Props = {
  index: number;
  total: number;
  tableLabel: string;
  qrSrc: string;
  className?: string;
};

/** Kişi başı bilet: sıra, masa ve QR (PNG kendi beyaz zeminini ve sessiz alanını taşır). */
export function TicketCard({ index, total, tableLabel, qrSrc, className }: Props) {
  return (
    <li className={cn("flex flex-col items-center gap-3 rounded-xl border border-line bg-surface p-4", className)}>
      <h3 className="m-0 text-lg font-semibold text-gold">{`Bilet ${index} / ${total}`}</h3>
      <p className="m-0 text-ivory">{`Masa ${tableLabel}`}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- veri adresi; next/image gerekmez */}
      <img src={qrSrc} alt={`Bilet ${index} QR kodu`} width={240} height={240} className="size-60 max-w-full rounded-lg" />
    </li>
  );
}
