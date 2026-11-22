"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateTemplateAction } from "../actions";
import { InvitationEditor } from "./editor/invitation-editor";
import type { EditorDesign } from "./editor/editor-state";

type Props = { id: string; name: string; description: string; initial: EditorDesign };

/** Şablon düzenleyicisi: ad/açıklama + tasarım. Şablonlarda görsel yükleme yoktur (görseller etkinliğe bağlıdır). */
export function TemplateEditor({ id, name: initialName, description: initialDescription, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  return (
    <InvitationEditor
      initial={initial}
      eventName="Etkinlik adı"
      eventDescription="Etkinlik açıklaması burada görünür."
      saveLabel="Şablonu kaydet"
      header={
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Şablon adı</span>
            <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Açıklama</span>
            <Textarea value={description} maxLength={500} rows={1} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
      }
      onSave={async (design) => {
        const res = await updateTemplateAction({
          id,
          name,
          description,
          size: design.size,
          width: design.width,
          height: design.height,
          backgroundColor: design.backgroundColor,
          backgroundImage: design.backgroundImage,
          backgroundGradient: design.backgroundGradient,
          elements: design.elements,
        });
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
