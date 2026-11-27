import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "error" | "demo";

const TONES: Record<Tone, string> = {
  info: "border-line bg-surface text-ivory",
  error: "border-danger bg-surface text-danger",
  demo: "border-gold bg-surface text-ivory",
};

type NoticeProps = HTMLAttributes<HTMLDivElement> & { tone?: Tone };

export function Notice({ tone = "info", className, ...rest }: NoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-[14px] border px-4 py-3", TONES[tone], className)}
      {...rest}
    />
  );
}
