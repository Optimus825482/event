import { z } from "zod";

/**
 * Sunucu ortamı. Bu dosya ve `core/client.ts` `"use client"` dosyalarından (dolaylı da olsa) içe aktarılmaz.
 */
export type SatisEnv = {
  CORE_API_URL: string;
  SALES_API_SECRET: string;
  SITE_URL: string;
  TRUSTED_IP_HEADER: string | undefined;
};

const httpUrl = z.url({ protocol: /^https?$/ });

export function parseEnv(source: Record<string, string | undefined>): SatisEnv {
  const leaked = Object.keys(source).find((key) => key.startsWith("NEXT_PUBLIC_") && key.includes("SECRET"));
  if (leaked) throw new Error("Sır NEXT_PUBLIC_ önekiyle verilemez");

  const production = source.NODE_ENV === "production";
  const schema = z.object({
    CORE_API_URL: httpUrl.transform((v) => v.replace(/\/+$/, "")),
    SALES_API_SECRET: z.string().min(32, "en az 32 karakter olmalı"),
    SITE_URL: httpUrl.refine((v) => !production || v.startsWith("https://"), "üretimde https:// olmalı"),
    TRUSTED_IP_HEADER: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.toLowerCase() : undefined))
      .refine((v) => !production || v !== undefined, "üretimde zorunlu"),
  });

  const result = schema.safeParse({
    CORE_API_URL: source.CORE_API_URL,
    SALES_API_SECRET: source.SALES_API_SECRET,
    SITE_URL: source.SITE_URL,
    TRUSTED_IP_HEADER: source.TRUSTED_IP_HEADER,
  });
  if (!result.success) {
    const reasons = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Geçersiz ortam değişkenleri: ${reasons}`);
  }
  return result.data;
}

export const env: SatisEnv = parseEnv(process.env);
