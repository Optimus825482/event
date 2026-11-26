import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Sınıf adlarını birleştirir; çakışan Tailwind sınıflarından sonuncusu kazanır. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
