"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
        <AlertTriangle className="h-10 w-10 text-red-400" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold text-white">Bir şeyler ters gitti</h1>
      <p className="max-w-md text-sm text-slate-400">
        Beklenmeyen bir hata oluştu.
        {error.digest ? ` (Başvuru kodu: ${error.digest})` : null}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()} className="bg-blue-600 text-white hover:bg-blue-700">
          <RefreshCw aria-hidden="true" />
          Tekrar dene
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline", className: "border-slate-600 text-slate-300 hover:bg-slate-700" })}>
          <Home aria-hidden="true" />
          Ana sayfa
        </Link>
      </div>
    </main>
  );
}
