"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ModalProps = {
  open: boolean;
  onClose(): void;
  labelledBy: string;
  id?: string;
  /** Kapalıyken de içerik HTML'de dursun (JS kapalı yedeği için). */
  keepMounted?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Yerel `<dialog>` üzerinde kipli pencere: `showModal()` arka planı etkisizleştirir (odak tuzağı),
 * Esc `cancel` olayıyla kapatır, kapanınca odak açan öğeye döner. Arka plana tıklamak da kapatır.
 */
export function Modal({ open, onClose, labelledBy, id, keepMounted, className, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      id={id}
      aria-modal="true"
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "modal m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-[20px] border border-line-gold bg-surface p-0 text-ivory shadow-2xl",
        className,
      )}
    >
      {open || keepMounted ? children : null}
    </dialog>
  );
}
