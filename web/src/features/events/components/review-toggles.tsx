"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { setEventReviewSettingsAction } from "../actions";

type Props = {
  id: string;
  reviewEnabled: boolean;
  reviewHistoryVisible: boolean;
  canEdit: boolean;
};

type Key = "reviewEnabled" | "reviewHistoryVisible";

const OPTIONS: { key: Key; label: string; description: string }[] = [
  {
    key: "reviewEnabled",
    label: "Personel değerlendirmesi açık",
    description: "Ekip liderleri bu etkinlikte personeli puanlayabilir.",
  },
  {
    key: "reviewHistoryVisible",
    label: "Geçmiş değerlendirmeler görünsün",
    description: "Liderler değerlendirme sırasında personelin önceki puanlarını görür.",
  },
];

/** Değerlendirme anahtarları (eski etkinlik ayrıntısındaki ayarlar). */
export function ReviewToggles({ id, reviewEnabled, reviewHistoryVisible, canEdit }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Record<Key, boolean>>({ reviewEnabled, reviewHistoryVisible });
  const [pending, setPending] = useState<Key | null>(null);

  async function toggle(key: Key, next: boolean) {
    const previous = values[key];
    setValues((v) => ({ ...v, [key]: next }));
    setPending(key);
    try {
      const res = await setEventReviewSettingsAction({ id, [key]: next });
      if (!res.ok) {
        setValues((v) => ({ ...v, [key]: previous }));
        toast.error(res.message);
        return;
      }
      toast.success(next ? "Ayar açıldı" : "Ayar kapatıldı");
      router.refresh();
    } catch {
      setValues((v) => ({ ...v, [key]: previous }));
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="review-settings-title" className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
      <h2 id="review-settings-title" className="mb-4 flex items-center gap-2 text-lg font-medium text-white">
        <Star className="h-5 w-5 text-amber-400" aria-hidden />
        Değerlendirme ayarları
      </h2>
      <ul className="space-y-4">
        {OPTIONS.map((option) => (
          <li key={option.key} className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor={`${id}-${option.key}`} className="text-sm font-medium text-white">
                {option.label}
              </label>
              <p className="text-sm text-slate-400">{option.description}</p>
            </div>
            <Switch
              id={`${id}-${option.key}`}
              checked={values[option.key]}
              disabled={!canEdit || pending !== null}
              onCheckedChange={(next) => void toggle(option.key, next)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
