"use client";

import { Bell, Globe, Mail, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PublicSettings } from "../service";
import { EmailSection } from "./email-section";
import { LogoForm } from "./logo-form";
import { BehaviorSection, GeneralSection, NotificationsSection } from "./settings-sections";

const TRIGGER = "data-[state=active]:bg-amber-600 data-[state=active]:text-white";

/**
 * Sistem ayarları sekmeleri (eski arayüzdeki Genel / E-posta / Bildirimler düzeni). Her sekme kendi
 * alanlarını ayrı kaydeder; `updateSettingsAction` kısmi güncellemeyi zaten destekler.
 * Eski "Güvenlik" sekmesinin karşılığı yeni şemada yoktur, bu yüzden yapılmadı.
 */
export function SettingsForm({ settings }: { settings: PublicSettings }) {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="h-auto flex-wrap border border-slate-700 bg-slate-800">
        <TabsTrigger value="general" className={TRIGGER}>
          <Globe className="h-4 w-4" aria-hidden="true" />
          Genel
        </TabsTrigger>
        <TabsTrigger value="behavior" className={TRIGGER}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Davranış
        </TabsTrigger>
        <TabsTrigger value="email" className={TRIGGER}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          E-posta
        </TabsTrigger>
        <TabsTrigger value="notifications" className={TRIGGER}>
          <Bell className="h-4 w-4" aria-hidden="true" />
          Bildirimler
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-6 space-y-6">
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle>Logo</CardTitle>
          </CardHeader>
          <CardContent>
            <LogoForm logo={settings.logo} />
          </CardContent>
        </Card>
        <GeneralSection settings={settings} />
      </TabsContent>
      <TabsContent value="behavior" className="mt-6">
        <BehaviorSection settings={settings} />
      </TabsContent>
      <TabsContent value="email" className="mt-6">
        <EmailSection settings={settings} />
      </TabsContent>
      <TabsContent value="notifications" className="mt-6">
        <NotificationsSection settings={settings} />
      </TabsContent>
    </Tabs>
  );
}
