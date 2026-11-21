"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Bir şeyler ters gitti</h1>
      <p className="text-sm text-muted-foreground">
        Beklenmeyen bir hata oluştu.
        {error.digest ? ` (Başvuru kodu: ${error.digest})` : null}
      </p>
      <Button onClick={() => retry()}>Tekrar dene</Button>
    </main>
  );
}
