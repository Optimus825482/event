"use client";

import { useState } from "react";
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  Edit3,
  Save,
  X,
  Camera,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { authApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function LeaderProfilePage() {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await authApi.updateProfile(formData);
      setMessage({ type: "success", text: "Profil başarıyla güncellendi" });
      setIsEditing(false);
    } catch (error) {
      setMessage({ type: "error", text: "Profil güncellenirken hata oluştu" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "Yeni şifreler eşleşmiyor" });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setMessage({ type: "error", text: "Şifre en az 6 karakter olmalı" });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      await authApi.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );
      setMessage({ type: "success", text: "Şifre başarıyla değiştirildi" });
      setIsChangingPassword(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      setMessage({ type: "error", text: "Şifre değiştirilirken hata oluştu" });
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: "Sistem Yöneticisi",
    leader: "Ekip Lideri",
    organizer: "Organizatör",
    staff: "Personel",
    venue_owner: "Mekan Sahibi",
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-amber-500/20 rounded-xl">
            <User className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Profilim</h1>
            <p className="text-slate-400 text-sm">
              Hesap bilgilerinizi görüntüleyin ve düzenleyin
            </p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={cn(
              "flex items-center gap-2 p-4 rounded-lg mb-6",
              message.type === "success"
                ? "bg-green-500/20 text-green-400"
                : "bg-red-500/20 text-red-400"
            )}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          {/* Avatar Section */}
          <div className="relative h-32 bg-gradient-to-r from-amber-500/20 to-orange-500/20">
            <div className="absolute -bottom-12 left-6">
              <div className="relative">
                <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center border-4 border-slate-800">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.fullName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-amber-400">
                      {user?.fullName?.charAt(0) || "U"}
                    </span>
                  )}
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-amber-500 rounded-full text-white hover:bg-amber-600 transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="pt-16 p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {user?.fullName}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                    {roleLabels[user?.role || "staff"]}
                  </span>
                  <span className="text-slate-500 text-sm">
                    @{user?.username}
                  </span>
                </div>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Düzenle
                </button>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Ad Soyad
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-700/50 rounded-lg">
                    <User className="w-5 h-5 text-slate-400" />
                    <span className="text-white">{user?.fullName || "-"}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  E-posta
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-700/50 rounded-lg">
                    <Mail className="w-5 h-5 text-slate-400" />
                    <span className="text-white">{user?.email || "-"}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Telefon
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-700/50 rounded-lg">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <span className="text-white">{user?.phone || "-"}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Rol</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-700/50 rounded-lg">
                  <Shield className="w-5 h-5 text-slate-400" />
                  <span className="text-white">
                    {roleLabels[user?.role || "staff"]}
                  </span>
                </div>
              </div>
            </div>

            {/* Edit Actions */}
            {isEditing && (
              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-700">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg text-white transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Kaydediliyor..." : "Kaydet"}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      fullName: user?.fullName || "",
                      email: user?.email || "",
                      phone: user?.phone || "",
                    });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                  İptal
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Password Change Section */}
        <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-white">
                Şifre Değiştir
              </h3>
            </div>
            {!isChangingPassword && (
              <button
                onClick={() => setIsChangingPassword(true)}
                className="text-sm text-amber-400 hover:text-amber-300"
              >
                Şifremi Değiştir
              </button>
            )}
          </div>

          {isChangingPassword && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Mevcut Şifre
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Yeni Şifre
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Yeni Şifre (Tekrar)
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={handleChangePassword}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg text-white transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Kaydediliyor..." : "Şifreyi Değiştir"}
                </button>
                <button
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordData({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                  İptal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
