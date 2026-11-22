export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" aria-hidden="true" />
      <p className="text-sm text-slate-400">Yükleniyor…</p>
    </div>
  );
}
