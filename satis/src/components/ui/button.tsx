import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "gold" | "glass" | "ghost";
type ButtonSize = "md" | "lg";

const BASE =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-5 text-center font-bold no-underline transition-all duration-150";
const VARIANTS: Record<ButtonVariant, string> = {
  gold: "bg-gold text-on-gold hover:-translate-y-px hover:bg-gold-bright",
  glass: "border border-line-gold bg-transparent text-ivory hover:border-gold hover:bg-glass",
  ghost: "border border-line text-muted hover:border-gold hover:bg-glass hover:text-ivory",
};
const SIZES: Record<ButtonSize, string> = { md: "py-2 text-base", lg: "min-h-12 py-3 text-lg" };
const DISABLED =
  "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-text";

export function buttonClass(variant: ButtonVariant = "gold", size: ButtonSize = "md"): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], DISABLED);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={cn(buttonClass(variant, size), className)} {...rest} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function ButtonLink({ variant, size, className, ...rest }: ButtonLinkProps) {
  return <Link className={cn(buttonClass(variant, size), className)} {...rest} />;
}
