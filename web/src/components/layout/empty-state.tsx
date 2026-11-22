import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Boş liste durumu: soluk simge, cümle ve isteğe bağlı eylem. */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed border-slate-700 px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 text-slate-600 [&_svg]:h-12 [&_svg]:w-12">{icon}</div>}
      <p className="text-base font-medium text-slate-300">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
