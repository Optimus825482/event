import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Erişim yok | EventFlow" };

/**
 * Yetkisiz kullanıcı bir sayfayı doğrudan açtığında gösterilir (`ForbiddenError`, bkz.
 * `features/auth/errors.ts`). Hangi iznin eksik olduğu gibi ayrıntı vermez.
 */
export default function Forbidden() {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold">Bu sayfaya erişim yetkiniz yok</h1>
      <p className="text-sm text-muted-foreground">
        Hesabınızın bu bölümü görme izni bulunmuyor. Gerekli olduğunu düşünüyorsanız yöneticinizle görüşün.
      </p>
      <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Ana sayfaya dön
      </Link>
    </div>
  );
}
