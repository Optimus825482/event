import type { ReactNode } from "react";

export function ContentPage({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <main className="page-gutter mx-auto max-w-[960px] space-y-8 py-12 sm:py-[84px]">
      <header className="space-y-4">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="text-[clamp(34px,5vw,56px)] text-ivory">{title}</h1>
        {lead ? <p className="max-w-[68ch] text-base leading-relaxed text-muted">{lead}</p> : null}
      </header>
      {children}
    </main>
  );
}
