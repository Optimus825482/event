"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Mail,
  Shield,
  Bell,
  Globe,
  Save,
  TestTube,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
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
import { Skeleton } from "@/components/ui/skeleton";
import { settingsApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast-notification";

interface SystemSettings {
  id: string;
  companyName: string;
  logo: string | null;
  timezone: string;
  language: string;
  defaultGridSize: number;
  snapToGrid: boolean;
  showGridByDefault: boolean;
  defaultGuestCount: number;
  allowOverbooking: boolean;
  requirePhoneNumber: boolean;
  requireEmail: boolean;
  autoCheckInEnabled: boolean;
  checkInSoundEnabled: boolean;
  showTableDirections: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  smtpSecure: boolean;
}

export default function AdminSettingsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<
    "success" | "error" | null
  >(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Canlı saat için useEffect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Form states
  const [generalSettings, setGeneralSettings] = useState({
    companyName: "",
    timezone: "Europe/Nicosia",
    language: "tr",
  });

  const [smtpSettings, setSmtpSettings] = useState({
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    smtpFromEmail: "",
    smtpFromName: "",
    smtpSecure: false,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
  });

  const [reservationSettings, setReservationSettings] = useState({
    defaultGuestCount: 2,
    allowOverbooking: false,
    requirePhoneNumber: true,
    requireEmail: false,
  });

  const [checkInSettings, setCheckInSettings] = useState({
    autoCheckInEnabled: false,
    checkInSoundEnabled: true,
    showTableDirections: true,
  });

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.get();
      const data = res.data as SystemSettings;
      setSettings(data);

      // Form state'lerini güncelle
      setGeneralSettings({
        companyName: data.companyName || "",
        timezone: data.timezone || "Europe/Nicosia",
        language: data.language || "tr",
      });

      setSmtpSettings({
        smtpHost: data.smtpHost || "",
        smtpPort: String(data.smtpPort || 587),
        smtpUser: data.smtpUser || "",
        smtpPassword: "", // Şifre gösterilmez
        smtpFromEmail: data.smtpFromEmail || "",
        smtpFromName: data.smtpFromName || "",
        smtpSecure: data.smtpSecure || false,
      });

      setNotificationSettings({
        emailNotifications: data.emailNotifications ?? true,
        smsNotifications: data.smsNotifications ?? false,
      });

      setReservationSettings({
        defaultGuestCount: data.defaultGuestCount || 2,
        allowOverbooking: data.allowOverbooking ?? false,
        requirePhoneNumber: data.requirePhoneNumber ?? true,
        requireEmail: data.requireEmail ?? false,
      });

      setCheckInSettings({
        autoCheckInEnabled: data.autoCheckInEnabled ?? false,
        checkInSoundEnabled: data.checkInSoundEnabled ?? true,
        showTableDirections: data.showTableDirections ?? true,
      });
    } catch (error) {
      console.error("Ayarlar yüklenemedi:", error);
      toast.error("Ayarlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      await settingsApi.update(generalSettings);
      toast.success("Genel ayarlar kaydedildi");
    } catch (error) {
      console.error("Kaydetme hatası:", error);
      toast.error("Ayarlar kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSmtp = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        smtpHost: smtpSettings.smtpHost || null,
        smtpPort: parseInt(smtpSettings.smtpPort) || 587,
        smtpUser: smtpSettings.smtpUser || null,
        smtpFromEmail: smtpSettings.smtpFromEmail || null,
        smtpFromName: smtpSettings.smtpFromName || null,
        smtpSecure: smtpSettings.smtpSecure,
      };

      // Şifre sadece girilmişse güncelle
      if (smtpSettings.smtpPassword) {
        updateData.smtpPassword = smtpSettings.smtpPassword;
      }

      await settingsApi.update(updateData);
      toast.success("SMTP ayarları kaydedildi");
      setSmtpSettings((prev) => ({ ...prev, smtpPassword: "" }));
    } catch (error) {
      console.error("Kaydetme hatası:", error);
      toast.error("SMTP ayarları kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      await settingsApi.update(notificationSettings);
      toast.success("Bildirim ayarları kaydedildi");
    } catch (error) {
      console.error("Kaydetme hatası:", error);
      toast.error("Bildirim ayarları kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    setSaving(true);
    try {
      await settingsApi.update({
        ...reservationSettings,
        ...checkInSettings,
      });
      toast.success("Güvenlik ayarları kaydedildi");
    } catch (error) {
      console.error("Kaydetme hatası:", error);
      toast.error("Güvenlik ayarları kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      await settingsApi.testSmtpConnection();
      setSmtpTestResult("success");
      toast.success("SMTP bağlantısı başarılı");
    } catch (error) {
      console.error("SMTP test hatası:", error);
      setSmtpTestResult("error");
      toast.error("SMTP bağlantısı başarısız");
    } finally {
      setTestingSmtp(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 bg-slate-700" />
          <Skeleton className="h-[400px] bg-slate-700 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <Breadcrumb />

        <PageHeader
          title="Sistem Ayarları"
          description="Genel sistem yapılandırması ve entegrasyonlar"
          icon={<Settings className="w-6 h-6 text-amber-400" />}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={loadSettings}
              className="border-slate-600"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          }
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
                    <Label>Şirket Adı</Label>
                    <Input
                      value={generalSettings.companyName}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          companyName: e.target.value,
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
                        <SelectValue placeholder="Zaman dilimi seçin" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="Europe/Nicosia">
                          Kıbrıs (UTC+2)
                        </SelectItem>
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
                    {/* Canlı Tarih ve Saat */}
                    <div className="mt-3 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                      <p className="text-xs text-slate-400 mb-1">
                        Şu anki tarih ve saat
                      </p>
                      <p className="text-lg font-mono text-amber-400">
                        {currentTime.toLocaleDateString("tr-TR", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          timeZone: generalSettings.timezone,
                        })}
                      </p>
                      <p className="text-2xl font-mono text-white">
                        {currentTime.toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          timeZone: generalSettings.timezone,
                        })}
                      </p>
                    </div>
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

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveGeneral}
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
                      placeholder="smtp.gmail.com"
                      value={smtpSettings.smtpHost}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          smtpHost: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input
                      value={smtpSettings.smtpPort}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          smtpPort: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kullanıcı Adı</Label>
                    <Input
                      value={smtpSettings.smtpUser}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          smtpUser: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Şifre</Label>
                    <Input
                      type="password"
                      placeholder="Değiştirmek için yeni şifre girin"
                      value={smtpSettings.smtpPassword}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          smtpPassword: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gönderen E-posta</Label>
                    <Input
                      placeholder="noreply@example.com"
                      value={smtpSettings.smtpFromEmail}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          smtpFromEmail: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gönderen Adı</Label>
                    <Input
                      placeholder="EventFlow PRO"
                      value={smtpSettings.smtpFromName}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          smtpFromName: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                  <div>
                    <p className="font-medium text-white">SSL/TLS Kullan</p>
                    <p className="text-sm text-slate-400">
                      Güvenli bağlantı için SSL/TLS etkinleştir
                    </p>
                  </div>
                  <Switch
                    checked={smtpSettings.smtpSecure}
                    onCheckedChange={(checked) =>
                      setSmtpSettings({ ...smtpSettings, smtpSecure: checked })
                    }
                  />
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
                    disabled={testingSmtp || !smtpSettings.smtpHost}
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
                    onClick={handleSaveSmtp}
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
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                  <div>
                    <p className="font-medium text-white">
                      E-posta Bildirimleri
                    </p>
                    <p className="text-sm text-slate-400">
                      Genel e-posta bildirimlerini aç/kapat
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        emailNotifications: checked,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                  <div>
                    <p className="font-medium text-white">SMS Bildirimleri</p>
                    <p className="text-sm text-slate-400">
                      SMS bildirimlerini aç/kapat (yakında)
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.smsNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        smsNotifications: checked,
                      })
                    }
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSaveNotifications}
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
            <div className="space-y-6">
              {/* Rezervasyon Ayarları */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">
                    Rezervasyon Ayarları
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Rezervasyon sistemi yapılandırması
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Varsayılan Misafir Sayısı</Label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={reservationSettings.defaultGuestCount}
                        onChange={(e) =>
                          setReservationSettings({
                            ...reservationSettings,
                            defaultGuestCount: parseInt(e.target.value) || 2,
                          })
                        }
                        className="bg-slate-700 border-slate-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                      <div>
                        <p className="font-medium text-white">
                          Telefon Zorunlu
                        </p>
                        <p className="text-sm text-slate-400">
                          Rezervasyonlarda telefon numarası zorunlu olsun
                        </p>
                      </div>
                      <Switch
                        checked={reservationSettings.requirePhoneNumber}
                        onCheckedChange={(checked) =>
                          setReservationSettings({
                            ...reservationSettings,
                            requirePhoneNumber: checked,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                      <div>
                        <p className="font-medium text-white">
                          E-posta Zorunlu
                        </p>
                        <p className="text-sm text-slate-400">
                          Rezervasyonlarda e-posta adresi zorunlu olsun
                        </p>
                      </div>
                      <Switch
                        checked={reservationSettings.requireEmail}
                        onCheckedChange={(checked) =>
                          setReservationSettings({
                            ...reservationSettings,
                            requireEmail: checked,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                      <div>
                        <p className="font-medium text-white">
                          Overbooking İzni
                        </p>
                        <p className="text-sm text-slate-400">
                          Kapasite üzeri rezervasyona izin ver
                        </p>
                      </div>
                      <Switch
                        checked={reservationSettings.allowOverbooking}
                        onCheckedChange={(checked) =>
                          setReservationSettings({
                            ...reservationSettings,
                            allowOverbooking: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Check-in Ayarları */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">
                    Check-in Ayarları
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Giriş kontrol sistemi yapılandırması
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                    <div>
                      <p className="font-medium text-white">
                        Otomatik Check-in
                      </p>
                      <p className="text-sm text-slate-400">
                        QR kod okutulduğunda otomatik giriş yap
                      </p>
                    </div>
                    <Switch
                      checked={checkInSettings.autoCheckInEnabled}
                      onCheckedChange={(checked) =>
                        setCheckInSettings({
                          ...checkInSettings,
                          autoCheckInEnabled: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                    <div>
                      <p className="font-medium text-white">Ses Efekti</p>
                      <p className="text-sm text-slate-400">
                        Check-in işlemlerinde ses çal
                      </p>
                    </div>
                    <Switch
                      checked={checkInSettings.checkInSoundEnabled}
                      onCheckedChange={(checked) =>
                        setCheckInSettings({
                          ...checkInSettings,
                          checkInSoundEnabled: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                    <div>
                      <p className="font-medium text-white">
                        Masa Yönlendirmesi
                      </p>
                      <p className="text-sm text-slate-400">
                        Check-in sonrası masa konumunu göster
                      </p>
                    </div>
                    <Switch
                      checked={checkInSettings.showTableDirections}
                      onCheckedChange={(checked) =>
                        setCheckInSettings({
                          ...checkInSettings,
                          showTableDirections: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleSaveSecurity}
                      disabled={saving}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Tüm Ayarları Kaydet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
