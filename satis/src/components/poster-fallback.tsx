import { cn } from "@/lib/cn";

export function PosterFallback({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string | null;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      data-variant="text"
      className={cn(
        "flex flex-col items-center justify-center border-y border-gold bg-surface-raised px-6 py-8 text-center",
        className,
      )}
    >
      <span className="h-px w-12 bg-gold" aria-hidden="true" />
      <p className="mt-4 font-serif text-2xl text-ivory">{title}</p>
      {subtitle ? <p className="mt-2 text-sm text-gold-bright">{subtitle}</p> : null}
      <span className="mt-4 h-px w-12 bg-gold" aria-hidden="true" />
    </div>
  );
}
