import { cn } from "@/lib/cn";

type Props = {
  index: number;
  total: number;
  tableLabel: string;
  seatNo: number | null;
  qrSrc: string;
  className?: string;
};

/** Kişi başı bilet: sıra, masa, sandalye (varsa) ve QR (PNG kendi beyaz zeminini ve sessiz alanını taşır). */
export function TicketCard({ index, total, tableLabel, seatNo, qrSrc, className }: Props) {
  return (
    <li
      className={cn(
        "flex flex-col items-center gap-3 rounded-[16px] border border-dashed border-line-gold bg-surface-raised p-5",
        className,
      )}
    >
      <p className="m-0 text-xs font-semibold uppercase tracking-wider text-gold-bright">✓ Onaylı E-Bilet</p>
      <h3 className="m-0 text-xl text-ivory">{`Bilet ${index} / ${total}`}</h3>
      <p className="m-0 text-sm font-semibold text-ivory">{`Masa ${tableLabel}`}</p>
      {seatNo !== null ? <p className="m-0 text-sm font-semibold text-gold-bright">{`Sandalye ${seatNo}`}</p> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- veri adresi; next/image gerekmez */}
      <img src={qrSrc} alt={`Bilet ${index} QR kodu`} width={240} height={240} className="h-auto w-60 max-w-full rounded-[12px]" />
    </li>
  );
}
