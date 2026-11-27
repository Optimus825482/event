import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export default function EventNotFound() {
  return (
    <main className="page-gutter mx-auto flex max-w-3xl flex-col items-start gap-4 py-12">
      <h1 className="text-[clamp(34px,5vw,56px)] text-ivory">Etkinlik bulunamadı</h1>
      <Notice>Bu etkinlik yok ya da satışta değil.</Notice>
      <ButtonLink href="/etkinlikler" variant="gold">
        Yaklaşan etkinliklere dön
      </ButtonLink>
    </main>
  );
}
