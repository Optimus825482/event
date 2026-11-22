import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action";

export type FieldErrors = Record<string, string[]> | undefined;
export type FormState = { ok: boolean; message: string; fieldErrors?: FieldErrors } | null;

/** Action sonucunu form durumuna çevirir (başarıda `okMessage`). */
export function toFormState<T>(result: ActionResult<T>, okMessage: string): FormState {
  return result.ok
    ? { ok: true, message: okMessage }
    : { ok: false, message: result.message, fieldErrors: result.fieldErrors };
}

export function Field({
  id,
  label,
  errors,
  hint,
  children,
}: {
  id: string;
  label: string;
  errors?: string[];
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {errors?.map((message) => (
        <p key={message} id={`${id}-error`} className="text-xs text-destructive">
          {message}
        </p>
      ))}
    </div>
  );
}

export function FormStatus({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
      {state.message}
    </p>
  );
}

export const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
