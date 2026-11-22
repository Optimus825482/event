import { auth, BCRYPT_COST, MIN_PASSWORD_LENGTH } from "@/features/auth/auth";
import { LOGIN_WINDOW_MINUTES, MAX_ATTEMPTS_ALL_IPS, MAX_ATTEMPTS_PER_IP } from "@/features/auth/login-attempts";

export type SecurityPolicy = {
  minPasswordLength: number;
  bcryptCost: number;
  /** Oturum ömrü (gün); yapılandırmadan okunamazsa `null`. */
  sessionDays: number | null;
  maxAttemptsPerIp: number;
  maxAttemptsAllIps: number;
  windowMinutes: number;
};

const SECONDS_PER_DAY = 60 * 60 * 24;

/** Salt okunur güvenlik politikası özeti; değerler kimlik doğrulama modüllerinin sabitlerinden gelir. */
export function getSecurityPolicy(): SecurityPolicy {
  const expiresIn = auth.options.session?.expiresIn;
  return {
    minPasswordLength: MIN_PASSWORD_LENGTH,
    bcryptCost: BCRYPT_COST,
    sessionDays: typeof expiresIn === "number" ? Math.round(expiresIn / SECONDS_PER_DAY) : null,
    maxAttemptsPerIp: MAX_ATTEMPTS_PER_IP,
    maxAttemptsAllIps: MAX_ATTEMPTS_ALL_IPS,
    windowMinutes: LOGIN_WINDOW_MINUTES,
  };
}
