import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

/** Tutma süresi dolduğunda gösterilen görünüm (sunucu ve istemci ortak). */
export function ExpiredView({ eventId }: { eventId: string }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h2 className="m-0 text-3xl text-ivory">Süreniz doldu</h2>
      <Notice>Seçtiğiniz masa serbest bırakıldı. Dilerseniz masayı yeniden seçebilirsiniz.</Notice>
      <ButtonLink href={`/etkinlik/${eventId}`} variant="gold">
        Masayı yeniden seç
      </ButtonLink>
    </div>
  );
}
