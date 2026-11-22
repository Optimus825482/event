"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const TIPS = [
  "Masa Grupları: grup ekleyin, planda masalara tıklayarak seçili gruba atayın; \"Alan seç\" ile dikdörtgen çizerek birden çok masayı ekleyin. Bir masa tek grupta olabilir. Grup satırındaki personel düğmesi grubun personelini açar.",
  "Ekipler: ekip kurun, üyelerini seçin, lider belirleyin ve her grubu bir ekibe bağlayın.",
  "Personel Atama: masa, özel görev ve servis noktası atamalarını yapın; servis noktası kartlarından personel seçebilir, otomatik dağıtım da kullanabilirsiniz.",
  "Ekstra Personel: kadro dışı geçici personeli ad soyad ile ekleyin.",
  "Geri al / Yinele (Ctrl+Z, Ctrl+Y) taslaktaki değişiklikleri adım adım geri alır; kaydedilen durum etkilenmez.",
  "Özet ve Kaydet: uyarıları kontrol edin ve tümünü tek seferde kaydedin. Kaydetmeden ayrılırsanız değişiklikler kaybolur.",
] as const;

/** Eski sihirbazdaki "Nasıl kullanılır" penceresi. */
export function TutorialDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HelpCircle aria-hidden className="size-4" />
          Nasıl kullanılır?
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ekip organizasyonu rehberi</DialogTitle>
          <DialogDescription>Adımları sırayla izleyin; her adıma istediğiniz zaman dönebilirsiniz.</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
