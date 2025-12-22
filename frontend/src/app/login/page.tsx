"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.username || !formData.password) {
      setError("Lütfen tüm alanları doldurun");
      return;
    }

    setLoading(true);

    try {
      const result = await login(formData.username, formData.password);
      console.log("Login result:", result);
      console.log("Result type:", typeof result);
      console.log("Is leader?:", result === "leader");

      if (result) {
        // Login fonksiyonu artık role döndürüyor (string veya false)
        if (result === "leader") {
          console.log("Redirecting to /leader");
          router.push("/leader");
        } else {
          console.log("Redirecting to /select-module");
          router.push("/select-module");
        }
      } else {
        setError("Kullanıcı adı veya şifre hatalı");
      }
    } catch {
      setError("Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/eventflowprologo.png"
            alt="EventFlow PRO"
            width={200}
            height={52}
            className="mx-auto mb-4"
            priority
          />
          <p className="text-slate-400 mt-2">Hesabınıza giriş yapın</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800 rounded-xl p-8 space-y-6"
        >
          {error && (
            <Alert variant="destructive" onClose={() => setError("")}>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Kullanıcı Adı
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500"
                placeholder="kullaniciadi"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Şifre</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-12 pr-12 py-3 focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center text-sm">
            <label className="flex items-center gap-2 text-slate-400">
              <input
                type="checkbox"
                className="rounded bg-slate-700 border-slate-600"
              />
              Beni hatırla
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        {/* Bilgi */}
        <div className="mt-6 bg-slate-800/50 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-2">
            Hesabınız yoksa admin ile iletişime geçin.
          </p>
        </div>
      </div>
    </div>
  );
}
