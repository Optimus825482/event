import { Home, SearchX } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/20">
        <SearchX className="h-10 w-10 text-blue-400" aria-hidden="true" />
      </div>
      <p className="text-5xl font-bold text-slate-600">404</p>
      <h1 className="text-2xl font-bold text-white">Sayfa bulunamadı</h1>
      <p className="max-w-md text-sm text-slate-400">Aradığınız sayfa yok ya da taşınmış olabilir.</p>
      <Link href="/" className={buttonVariants({ className: "bg-blue-600 text-white hover:bg-blue-700" })}>
        <Home aria-hidden="true" />
        Ana sayfaya dön
      </Link>
    </main>
  );
}
