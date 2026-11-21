export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Yükleniyor…</p>
    </div>
  );
}
