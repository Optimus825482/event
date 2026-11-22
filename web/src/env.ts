import { z } from "zod";

const DEV_AUTH_URL = "http://localhost:3000";

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    // Üretimde zorunlu ve https://; geliştirme/testte varsayılan DEV_AUTH_URL.
    BETTER_AUTH_URL: z.string().min(1).optional(),
    UPLOAD_DIR: z.string().min(1).default("./uploads"),
    // Ayarlardaki gizli değerleri (SMTP parolası) şifreleyen anahtar: 32 bayt, base64. İsteğe bağlı;
    // tanımsızsa yalnızca gizli değer kaydetme/okuma başarısız olur.
    SETTINGS_ENCRYPTION_KEY: z
      .string()
      .optional()
      .refine((value) => !value || Buffer.from(value, "base64").length === 32, "base64 çözüldüğünde 32 bayt olmalıdır"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // İstemci IP'sinin okunacağı, ters vekilin (ör. Traefik) yazdığı başlık. Üretimde
    // zorunlu; geliştirme/testte tanımsızsa istemcinin gönderdiği hiçbir başlığa güvenilmez.
    TRUSTED_IP_HEADER: z
      .string()
      .optional()
      .transform((value) => value?.trim().toLowerCase() || undefined),
    // `next build` NODE_ENV=production ile çalışır ama çalışma zamanı ortamı değildir.
    NEXT_PHASE: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production" || value.NEXT_PHASE === "phase-production-build") return;
    if (!value.BETTER_AUTH_URL) {
      ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_URL"], message: "üretimde zorunludur" });
    } else if (!value.BETTER_AUTH_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_URL"], message: "üretimde https:// ile başlamalıdır" });
    }
    if (!value.TRUSTED_IP_HEADER) {
      ctx.addIssue({
        code: "custom",
        path: ["TRUSTED_IP_HEADER"],
        message: "üretimde zorunludur (Traefik arkasında x-real-ip kullanın)",
      });
    }
  })
  .transform((value) => ({ ...value, BETTER_AUTH_URL: value.BETTER_AUTH_URL ?? DEV_AUTH_URL }));

export type Env = z.output<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(env)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Geçersiz ortam değişkenleri: ${details}`);
  }
  return result.data;
}

export const env: Env = parseEnv(process.env);
