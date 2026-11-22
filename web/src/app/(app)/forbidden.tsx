import { Home, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Erişim yok | EventFlow" };

/**
 * Yetkisiz kullanıcı bir sayfayı doğrudan açtığında gösterilir (`ForbiddenError`, bkz.
 * `features/auth/errors.ts`). Hangi iznin eksik olduğu gibi ayrıntı vermez.
 */
export default function Forbidden() {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20">
        <ShieldAlert className="h-10 w-10 text-amber-400" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold text-white">Bu sayfaya erişim yetkiniz yok</h1>
      <p className="text-sm text-slate-400">
        Hesabınızın bu bölümü görme izni bulunmuyor. Gerekli olduğunu düşünüyorsanız yöneticinizle görüşün.
      </p>
      <Link href="/" className={buttonVariants({ className: "bg-blue-600 text-white hover:bg-blue-700" })}>
        <Home aria-hidden="true" />
        Ana sayfaya dön
      </Link>
    </div>
  );
}
