"use client";

import type { LucideIcon } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type ConsoleTabDef<Id extends string> = { id: Id; label: string; icon: LucideIcon };

export const tabDomId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelDomId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/**
 * Erişilebilir sekme çubuğu (tablist/tab): oklar, Home ve End ile gezinilir; yalnızca etkin sekme
 * sekme sırasındadır. Paneller çağıranda `role="tabpanel"` ile kalıcı olarak bağlanır.
 */
export function ConsoleTabs<Id extends string>({
  tabs,
  active,
  onChange,
  prefix,
  label,
}: {
  tabs: readonly ConsoleTabDef<Id>[];
  active: Id;
  onChange: (id: Id) => void;
  prefix: string;
  label: string;
}) {
  const refs = useRef(new Map<Id, HTMLButtonElement>());

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === active);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    const target = tabs[next];
    if (!target) return;
    onChange(target.id);
    refs.current.get(target.id)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      className="grid gap-1 rounded-xl border border-slate-700 bg-slate-800 p-1"
    >
      {tabs.map(({ id, label: text, icon: Icon }) => {
        const selected = id === active;
        return (
          <button
            key={id}
            ref={(node) => {
              if (node) refs.current.set(id, node);
              else refs.current.delete(id);
            }}
            type="button"
            role="tab"
            id={tabDomId(prefix, id)}
            aria-selected={selected}
            aria-controls={panelDomId(prefix, id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
              selected ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-700 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {text}
          </button>
        );
      })}
    </div>
  );
}
