"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settings-store";
import {
  Bell,
  Mail,
  MessageSquare,
  Loader2,
  Server,
  Lock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { settingsApi } from "@/lib/api";

export function NotificationSettings() {
  const { systemSettings, fetchSettings, updateSettings, loading } =
    useSettingsStore();
  const [localSettings, setLocalSettings] = useState(systemSettings);
  const [saving, setSaving] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // SMTP ayarları için local state
  const [smtpSettings, setSmtpSettings] = useState({
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    smtpFromEmail: "",
    smtpFromName: "",
    smtpSecure: false,
  });

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (systemSettings) {
      setLocalSettings(systemSettings);
      // SMTP ayarlarını da yükle
      setSmtpSettings({
        smtpHost: systemSettings.smtpHost || "",
        smtpPort: systemSettings.smtpPort || 587,
        smtpUser: systemSettings.smtpUser || "",
        smtpPassword: systemSettings.smtpPassword || "",
        smtpFromEmail: systemSettings.smtpFromEmail || "",
        smtpFromName: systemSettings.smtpFromName || "",
        smtpSecure: systemSettings.smtpSecure || false,
      });
    }
  }, [systemSettings]);

  const handleSave = async () => {
    if (!localSettings) return;
    setSaving(true);
    setNotification(null);
    try {
      await updateSettings({
        emailNotifications: localSettings.emailNotifications,
        smsNotifications: localSettings.smsNotifications,
        ...smtpSettings,
      });
      setNotification({ type: "success", message: "Ayarlar kaydedildi" });
    } catch {
      setNotification({ type: "error", message: "Kaydetme hatası" });
    } finally {
      setSaving(false);
    }
  };

  // Test email modal
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);

  // SMTP bağlantı testi
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const response = await settingsApi.testSmtpConnection();
      setConnectionStatus({
        tested: true,
        success: response.data.success,
        message: response.data.message,
      });
    } catch (error: any) {
      setConnectionStatus({
        tested: true,
        success: false,
        message: error.response?.data?.message || "Bağlantı testi başarısız",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    setSendingTest(true);
    try {
      const response = await settingsApi.sendTestEmail(testEmail);
      if (response.data.success) {
        setNotification({
          type: "success",
          message: `Test e-postası ${testEmail} adresine gönderildi`,
        });
        setShowTestEmailModal(false);
        setTestEmail("");
      } else {
        setNotification({
          type: "error",
          message: response.data.error || "E-posta gönderilemedi",
        });
      }
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error.response?.data?.message || "E-posta gönderilemedi",
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading || !localSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notification && (
        <Alert
          variant={notification.type === "success" ? "success" : "destructive"}
          onClose={() => setNotification(null)}
        >
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Bildirim Ayarları
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          E-posta, SMS ve uygulama içi bildirim tercihleri
        </p>
      </div>

      {/* Bildirim Türleri */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-300">
          Bildirim Kanalları
        </h3>

        <label className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-purple-400" />
            <div>
              <p className="font-medium">Uygulama İçi Bildirimler</p>
              <p className="text-sm text-slate-400">
                Rezervasyon, check-in ve etkinlik bildirimleri
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={true}
            disabled
            className="w-5 h-5 rounded bg-slate-600 border-slate-500"
          />
        </label>

        <label className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-blue-400" />
            <div>
              <p className="font-medium">E-posta Bildirimleri</p>
              <p className="text-sm text-slate-400">
                Rezervasyon onayı ve hatırlatmalar
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={localSettings.emailNotifications}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                emailNotifications: e.target.checked,
              })
            }
            className="w-5 h-5 rounded bg-slate-600 border-slate-500"
          />
        </label>

        <label className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-green-400" />
            <div>
              <p className="font-medium">SMS Bildirimleri</p>
              <p className="text-sm text-slate-400">
                QR kod ve hatırlatma mesajları
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={localSettings.smsNotifications}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                smsNotifications: e.target.checked,
              })
            }
            className="w-5 h-5 rounded bg-slate-600 border-slate-500"
          />
        </label>
      </div>

      {/* E-posta (SMTP) Ayarları */}
      {localSettings.emailNotifications && (
        <div className="space-y-4 pt-4 border-t border-slate-700">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Server className="w-4 h-4" />
            E-posta Sunucu Ayarları (SMTP)
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                SMTP Sunucu
              </label>
              <input
                type="text"
                value={smtpSettings.smtpHost}
                onChange={(e) =>
                  setSmtpSettings({ ...smtpSettings, smtpHost: e.target.value })
                }
                placeholder="smtp.example.com"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Port</label>
              <input
                type="number"
                value={smtpSettings.smtpPort}
                onChange={(e) =>
                  setSmtpSettings({
                    ...smtpSettings,
                    smtpPort: Number(e.target.value),
                  })
                }
                placeholder="587"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={smtpSettings.smtpUser}
                onChange={(e) =>
                  setSmtpSettings({ ...smtpSettings, smtpUser: e.target.value })
                }
                placeholder="user@example.com"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Şifre</label>
              <div className="relative">
                <input
                  type={showSmtpPassword ? "text" : "password"}
                  value={smtpSettings.smtpPassword}
                  onChange={(e) =>
                    setSmtpSettings({
                      ...smtpSettings,
                      smtpPassword: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <Lock className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Gönderen E-posta
              </label>
              <input
                type="email"
                value={smtpSettings.smtpFromEmail}
                onChange={(e) =>
                  setSmtpSettings({
                    ...smtpSettings,
                    smtpFromEmail: e.target.value,
                  })
                }
                placeholder="noreply@example.com"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Gönderen Adı
              </label>
              <input
                type="text"
                value={smtpSettings.smtpFromName}
                onChange={(e) =>
                  setSmtpSettings({
                    ...smtpSettings,
                    smtpFromName: e.target.value,
                  })
                }
                placeholder="EventFlow PRO"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={smtpSettings.smtpSecure}
              onChange={(e) =>
                setSmtpSettings({
                  ...smtpSettings,
                  smtpSecure: e.target.checked,
                })
              }
              className="rounded bg-slate-600 border-slate-500"
            />
            SSL/TLS Kullan (Port 465 için)
          </label>

          {/* Bağlantı Durumu */}
          {connectionStatus && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 ${
                connectionStatus.success
                  ? "bg-green-600/20 border border-green-600/30"
                  : "bg-red-600/20 border border-red-600/30"
              }`}
            >
              {connectionStatus.success ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span
                className={
                  connectionStatus.success ? "text-green-400" : "text-red-400"
                }
              >
                {connectionStatus.message}
              </span>
            </div>
          )}

          {/* Test Butonları */}
          <div className="flex gap-3">
            <button
              onClick={handleTestConnection}
              disabled={testingConnection || !smtpSettings.smtpHost}
              className="px-4 py-2 bg-slate-600 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {testingConnection && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {testingConnection ? "Test Ediliyor..." : "Bağlantıyı Test Et"}
            </button>
            <button
              onClick={() => setShowTestEmailModal(true)}
              disabled={!smtpSettings.smtpHost}
              className="px-4 py-2 bg-blue-600 rounded-lg text-sm disabled:opacity-50"
            >
              Test E-postası Gönder
            </button>
          </div>

          {/* Spam Önleme İpuçları */}
          <div className="p-4 bg-slate-700/50 rounded-lg">
            <h4 className="text-sm font-medium text-slate-300 mb-2">
              📧 E-postaların Spam&apos;a Düşmemesi İçin
            </h4>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• SPF kaydı: Gönderen domain için SPF kaydı ekleyin</li>
              <li>• DKIM: E-posta imzalama için DKIM yapılandırın</li>
              <li>• DMARC: Domain doğrulama politikası belirleyin</li>
              <li>
                • Gönderen adresi: Gerçek ve doğrulanmış bir adres kullanın
              </li>
              <li>• İçerik: Spam tetikleyici kelimelerden kaçının</li>
            </ul>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showTestEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Test E-postası Gönder
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              SMTP ayarlarınızı test etmek için bir e-posta adresi girin.
            </p>
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-1">
                E-posta Adresi
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTestEmailModal(false);
                  setTestEmail("");
                }}
                className="flex-1 py-2 bg-slate-700 rounded-lg"
              >
                İptal
              </button>
              <button
                onClick={handleTestEmail}
                disabled={!testEmail || sendingTest}
                className="flex-1 py-2 bg-blue-600 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingTest && <Loader2 className="w-4 h-4 animate-spin" />}
                {sendingTest ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Uyarısı */}
      {localSettings.smsNotifications && (
        <div className="p-4 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ SMS bildirimleri için SMS sağlayıcı entegrasyonu gereklidir.
          </p>
        </div>
      )}

      <div className="pt-4 border-t border-slate-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
