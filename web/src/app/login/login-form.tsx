"use client";

import { useRouter } from "next/navigation";
import { GENERIC_LOGIN_ERROR, loginErrorMessage } from "@/features/auth/login-error";
import { clearSignOutPending } from "@/features/auth/sign-out";
import { safeNextPath } from "@/features/auth/next-path";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";


const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-700 py-3 pl-12 pr-4 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      // Doğrudan Better Auth ucuna gider: hız sınırı ve httpOnly çerez orada uygulanır.
      const res = await fetch("/api/auth/sign-in/username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username: String(form.get("username") ?? ""),
          password: String(form.get("password") ?? ""),
          // İşaretsiz: Better Auth oturum çerezini Max-Age'siz (tarayıcı kapanınca biten) yazar ve oturumu kısa tutar.
          rememberMe: form.get("rememberMe") === "on",
        }),
      });
      if (!res.ok) {
        setError(loginErrorMessage(res.status, res.headers.get("retry-after") ?? res.headers.get("x-retry-after")));
        return;
      }
      // Yeni oturum açıldı: eski, ertelenmiş çıkış isteği bu oturumu kapatmasın.
      clearSignOutPending(window.localStorage);
      router.replace(safeNextPath(next));
      router.refresh();
    } catch {
      setError(GENERIC_LOGIN_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl bg-slate-800 p-8" noValidate>
      <div
        role="alert"
        aria-live="polite"
        className={error ? "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" : "sr-only"}
      >
        {error}
      </div>
      <div>
        <label htmlFor="username" className="mb-2 block text-sm text-slate-400">
          Kullanıcı Adı
        </label>
        <div className="relative">
          <User aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="kullaniciadi"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm text-slate-400">
          Parola
        </label>
        <div className="relative">
          <Lock aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            aria-pressed={showPassword}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            {showPassword ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-400">
        <input
          type="checkbox"
          name="rememberMe"
          defaultChecked
          className="h-4 w-4 rounded border-slate-600 bg-slate-700 accent-blue-600"
        />
        Beni hatırla
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>
    </form>
  );
}
