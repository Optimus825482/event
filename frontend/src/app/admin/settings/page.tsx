"use client";

import { useState } from "react";
import {
  Settings,
  Mail,
  Shield,
  Database,
  Bell,
  Globe,
  Save,
  TestTube,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminSettingsPage() {
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<
    "success" | "error" | null
  >(null);

  // Form states
  const [generalSettings, setGeneralSettings] = useState({
    siteName: "EventFlow PRO",
    siteUrl: "https://eventflow.pro",
    timezone: "Europe/Istanbul",
    language: "tr",
    maintenanceMode: false,
  });

  const [smtpSettings, setSmtpSettings] = useState({
    host: "smtp.gmail.com",
    port: "587",
    username: "",
    password: "",
    fromEmail: "noreply@eventflow.pro",
    fromName: "EventFlow PRO",
    encryption: "tls",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    reservationAlerts: true,
    checkInAlerts: true,
    systemAlerts: true,
    dailyReports: false,
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSmtpTestResult(Math.random() > 0.3 ? "success" : "error");
    setTestingSmtp(false);
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        <Breadcrumb />

        <PageHeader
          title="Sistem Ayarları"
          description="Genel sistem yapılandırması ve entegrasyonlar"
          icon={<Settings className="w-6 h-6 text-amber-400" />}
        />

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger
              value="general"
              className="data-[state=active]:bg-amber-600"
            >
              <Globe className="w-4 h-4 mr-2" />
              Genel
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className="data-[state=active]:bg-amber-600"
            >
              <Mail className="w-4 h-4 mr-2" />
              E-posta
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="data-[state=active]:bg-amber-600"
            >
              <Bell className="w-4 h-4 mr-2" />
              Bildirimler
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="data-[state=active]:bg-amber-600"
            >
              <Shield className="w-4 h-4 mr-2" />
              Güvenlik
            </TabsTrigger>
          </TabsList>

          {/* Genel Ayarlar */}
          <TabsContent value="general" className="mt-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Genel Ayarlar</CardTitle>
                <CardDescription className="text-slate-400">
                  Temel sistem yapılandırması
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Site Adı</Label>
                    <Input
                      value={generalSettings.siteName}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          siteName: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Site URL</Label>
                    <Input
                      value={generalSettings.siteUrl}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          siteUrl: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Zaman Dilimi</Label>
                    <Select
                      value={generalSettings.timezone}
                      onValueChange={(v) =>
                        setGeneralSettings({ ...generalSettings, timezone: v })
                      }
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="Europe/Istanbul">
                          İstanbul (UTC+3)
                        </SelectItem>
                        <SelectItem value="Europe/London">
                          Londra (UTC+0)
                        </SelectItem>
                        <SelectItem value="America/New_York">
                          New York (UTC-5)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Dil</Label>
                    <Select
                      value={generalSettings.language}
                      onValueChange={(v) =>
                        setGeneralSettings({ ...generalSettings, language: v })
                      }
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="tr">Türkçe</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                  <div>
                    <p className="font-medium text-white">Bakım Modu</p>
                    <p className="text-sm text-slate-400">
                      Aktif edildiğinde sadece adminler erişebilir
                    </p>
                  </div>
                  <Switch
                    checked={generalSettings.maintenanceMode}
                    onCheckedChange={(checked) =>
                      setGeneralSettings({
                        ...generalSettings,
                        maintenanceMode: checked,
                      })
                    }
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* E-posta Ayarları */}
          <TabsContent value="email" className="mt-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">SMTP Ayarları</CardTitle>
                <CardDescription className="text-slate-400">
                  E-posta gönderimi için SMTP yapılandırması
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>SMTP Sunucu</Label>
                    <Input
                      value={smtpSettings.host}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          host: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input
                      value={smtpSettings.port}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          port: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kullanıcı Adı</Label>
                    <Input
                      value={smtpSettings.username}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          username: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Şifre</Label>
                    <Input
                      type="password"
                      value={smtpSettings.password}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          password: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gönderen E-posta</Label>
                    <Input
                      value={smtpSettings.fromEmail}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          fromEmail: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gönderen Adı</Label>
                    <Input
                      value={smtpSettings.fromName}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          fromName: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                </div>

                {smtpTestResult && (
                  <div
                    className={`p-4 rounded-lg ${
                      smtpTestResult === "success"
                        ? "bg-green-500/10 border border-green-500/30"
                        : "bg-red-500/10 border border-red-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {smtpTestResult === "success" ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                          <span className="text-green-400">
                            SMTP bağlantısı başarılı!
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-red-400" />
                          <span className="text-red-400">
                            SMTP bağlantısı başarısız. Ayarları kontrol edin.
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleTestSmtp}
                    disabled={testingSmtp}
                    className="border-slate-600"
                  >
                    {testingSmtp ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4 mr-2" />
                    )}
                    Bağlantıyı Test Et
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bildirim Ayarları */}
          <TabsContent value="notifications" className="mt-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Bildirim Ayarları</CardTitle>
                <CardDescription className="text-slate-400">
                  Sistem bildirimlerini yapılandırın
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    key: "emailNotifications",
                    label: "E-posta Bildirimleri",
                    desc: "Genel e-posta bildirimlerini aç/kapat",
                  },
                  {
                    key: "reservationAlerts",
                    label: "Rezervasyon Uyarıları",
                    desc: "Yeni rezervasyonlarda bildirim al",
                  },
                  {
                    key: "checkInAlerts",
                    label: "Check-in Uyarıları",
                    desc: "Misafir girişlerinde bildirim al",
                  },
                  {
                    key: "systemAlerts",
                    label: "Sistem Uyarıları",
                    desc: "Kritik sistem olaylarında bildirim al",
                  },
                  {
                    key: "dailyReports",
                    label: "Günlük Raporlar",
                    desc: "Her gün özet rapor e-postası al",
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600"
                  >
                    <div>
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="text-sm text-slate-400">{item.desc}</p>
                    </div>
                    <Switch
                      checked={
                        notificationSettings[
                          item.key as keyof typeof notificationSettings
                        ]
                      }
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          [item.key]: checked,
                        })
                      }
                    />
                  </div>
                ))}

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Güvenlik Ayarları */}
          <TabsContent value="security" className="mt-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Güvenlik Ayarları</CardTitle>
                <CardDescription className="text-slate-400">
                  Sistem güvenlik yapılandırması
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Oturum Süresi (dakika)</Label>
                    <Input
                      type="number"
                      defaultValue="60"
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Maksimum Giriş Denemesi</Label>
                    <Input
                      type="number"
                      defaultValue="5"
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                    <div>
                      <p className="font-medium text-white">
                        İki Faktörlü Doğrulama
                      </p>
                      <p className="text-sm text-slate-400">
                        Admin kullanıcılar için 2FA zorunlu
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                    <div>
                      <p className="font-medium text-white">IP Kısıtlaması</p>
                      <p className="text-sm text-slate-400">
                        Sadece belirli IP'lerden erişime izin ver
                      </p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                    <div>
                      <p className="font-medium text-white">Aktivite Logları</p>
                      <p className="text-sm text-slate-400">
                        Tüm kullanıcı aktivitelerini kaydet
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
