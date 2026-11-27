import type { EventFact } from "./facts";

export function EventFacts({ facts }: { facts: EventFact[] }): React.JSX.Element {
  return (
    <dl className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className="rounded-[14px] border border-line bg-surface p-3.5">
          <dt className="text-[11.5px] font-bold uppercase tracking-wider text-gold-bright">{fact.label}</dt>
          <dd className="mt-1 text-[14.5px] font-semibold text-ivory">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
