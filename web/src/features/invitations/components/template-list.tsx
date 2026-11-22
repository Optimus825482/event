"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SELECT_CLASS } from "@/features/users/components/field";
import { createTemplateAction, deleteTemplateAction, setDefaultTemplateAction } from "../actions";
import { INVITATION_SIZES, SIZE_KEYS, type InvitationSizeKey } from "../elements";

export type TemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  size: string;
  isDefault: boolean;
  isSystemTemplate: boolean;
  canManage: boolean;
};

type Props = { templates: TemplateListItem[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; isAdmin: boolean };
type Outcome = { ok: true } | { ok: false; message: string };

function isSizeKey(value: string): value is InvitationSizeKey {
  return (SIZE_KEYS as readonly string[]).includes(value);
}

export function TemplateList({ templates, canCreate, canEdit, canDelete, isAdmin }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [size, setSize] = useState<InvitationSizeKey>("A5");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<Outcome>, success: string) {
    setBusy(true);
    setMessage(null);
    const res = await task();
    setBusy(false);
    if (!res.ok) return setMessage({ ok: false, text: res.message });
    setMessage({ ok: true, text: success });
    router.refresh();
  }

  async function create(): Promise<Outcome> {
    const preset = INVITATION_SIZES[size];
    const res = await createTemplateAction({
      name,
      size,
      width: preset.width,
      height: preset.height,
      backgroundColor: "#FFFFFF",
      backgroundImage: null,
      backgroundGradient: null,
      elements: [],
    });
    if (res.ok) {
      setName("");
      router.push(`/templates/${res.data.id}`);
      return { ok: true };
    }
    return { ok: false, message: res.fieldErrors?.name?.[0] ?? res.message };
  }

  return (
    <div className="space-y-6">
      {canCreate ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-md border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(create, "Şablon oluşturuldu");
          }}
        >
          <label className="min-w-48 flex-1 space-y-1 text-sm">
            <span className="font-medium">Yeni şablon adı</span>
            <Input value={name} maxLength={120} required onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Boyut</span>
            <select className={SELECT_CLASS} value={size} onChange={(e) => isSizeKey(e.target.value) && setSize(e.target.value)}>
              {SIZE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {INVITATION_SIZES[key].label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={busy || name.trim() === ""}>
            Oluştur
          </Button>
        </form>
      ) : null}

      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
          {message.text}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <li key={t.id} className="space-y-3 rounded-md border border-border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate font-medium">{t.name}</h2>
                <p className="text-xs text-muted-foreground">{t.description ?? "Açıklama yok"}</p>
              </div>
              <div className="flex shrink-0 gap-1 text-xs">
                <span className="rounded-full border border-border px-2 py-0.5">{t.size}</span>
                {t.isDefault ? <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">Varsayılan</span> : null}
                {t.isSystemTemplate ? <span className="rounded-full border border-border px-2 py-0.5">Sistem</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && t.canManage ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/templates/${t.id}`}>Düzenle</Link>
                </Button>
              ) : null}
              {canEdit && isAdmin && !t.isDefault ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run(() => setDefaultTemplateAction({ id: t.id }), "Varsayılan şablon güncellendi")}
                >
                  Varsayılan yap
                </Button>
              ) : null}
              {canDelete && t.canManage && !t.isSystemTemplate ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`"${t.name}" şablonu silinecek. Devam edilsin mi?`)) {
                      void run(() => deleteTemplateAction({ id: t.id }), "Şablon silindi");
                    }
                  }}
                >
                  Sil
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
