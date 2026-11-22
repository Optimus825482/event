"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SELECT_CLASS } from "@/features/users/components/field";
import { saveEventInvitationAction } from "../actions";
import { InvitationEditor } from "./editor/invitation-editor";
import type { EditorDesign } from "./editor/editor-state";

type Props = {
  eventId: string;
  eventName: string;
  eventDescription: string;
  initial: EditorDesign;
  images: string[];
  templates: { id: string; name: string; isDefault: boolean; design: EditorDesign }[];
  templateId: string | null;
};

/**
 * Etkinlik davetiyesi düzenleyicisi. Kayıt her zaman özel tasarım olarak yapılır
 * (`customElements`); seçili şablon yalnızca başlangıç noktasıdır.
 */
export function EventInvitationEditor({ eventId, eventName, eventDescription, initial, images, templates, templateId }: Props) {
  const router = useRouter();
  const [knownImages, setKnownImages] = useState(images);
  const [chosen, setChosen] = useState(templateId ?? "");
  // Şablon yüklenince düzenleyici yeni başlangıç tasarımıyla yeniden kurulur.
  const [start, setStart] = useState({ design: initial, version: 0 });

  function loadTemplate() {
    const template = templates.find((t) => t.id === chosen);
    if (!template) return;
    if (!window.confirm("Mevcut tasarım seçili şablonla değiştirilecek. Kaydedilmemiş değişiklikler kaybolur. Devam edilsin mi?")) return;
    setStart((current) => ({ design: template.design, version: current.version + 1 }));
  }

  return (
    <InvitationEditor
      key={start.version}
      initial={start.design}
      eventName={eventName}
      eventDescription={eventDescription}
      eventImages={{ eventId, initial: knownImages, onChange: setKnownImages }}
      header={
        <label className="block max-w-xs space-y-1 text-sm">
          <span className="font-medium text-slate-300">Kaynak şablon</span>
          <select className={SELECT_CLASS} value={chosen} onChange={(e) => setChosen(e.target.value)}>
            <option value="">Seçili değil (varsayılan)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isDefault ? " (varsayılan)" : ""}
              </option>
            ))}
          </select>
          <span className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!chosen} onClick={loadTemplate}>
              Şablonu yükle
            </Button>
          </span>
          <span className="block text-xs text-muted-foreground">Kaydettiğinizde bu etkinliğe özel tasarım olarak saklanır.</span>
        </label>
      }
      onSave={async (design) => {
        const res = await saveEventInvitationAction({
          eventId,
          templateId: chosen || null,
          customElements: design.elements,
          size: design.size,
          width: design.width,
          height: design.height,
          backgroundColor: design.backgroundColor,
          backgroundImage: design.backgroundImage,
          backgroundGradient: design.backgroundGradient,
          companyLogo: null,
        });
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
