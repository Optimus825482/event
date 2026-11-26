import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export default function EventNotFound() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-6">
      <h1 className="text-3xl font-semibold text-gold">Etkinlik bulunamadı</h1>
      <Notice>Bu etkinlik yok ya da satışta değil.</Notice>
      <ButtonLink href="/" variant="gold">
        Etkinliklere dön
      </ButtonLink>
    </main>
  );
}
