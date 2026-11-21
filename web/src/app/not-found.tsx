import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Sayfa bulunamadı</h1>
      <p className="text-sm text-muted-foreground">Aradığınız sayfa yok ya da taşınmış olabilir.</p>
      <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Ana sayfaya dön
      </Link>
    </main>
  );
}
