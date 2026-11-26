import { loadE2eEnv } from "./env";

// Varsayılanlar eventflow_e2e / 3100 / 3101; paralel worktree'ler E2E_DB_NAME, E2E_PORT, E2E_PROD_PORT ile ayrışır.
const e2eEnv = loadE2eEnv();

export const E2E_PORT = e2eEnv.port;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DB_NAME = e2eEnv.dbName;
export const PG_BASE_URL = "postgres://postgres@localhost:54329";
export const E2E_DATABASE_URL = `${PG_BASE_URL}/${E2E_DB_NAME}`;
export const ADMIN_USERNAME = "e2e-admin";
export const AUTH_STATE_FILE = "e2e/.auth/admin.json";

/** Üretim derlemesi (service worker yalnızca burada kayıtlı): kendi portu, kendi distDir'i. */
export const PROD_PORT = e2eEnv.prodPort;
export const PROD_BASE_URL = `http://localhost:${PROD_PORT}`;
export const PROD_DIST_DIR = ".next-e2e/prod";
/** Üretim modu https:// BETTER_AUTH_URL ister; tarayıcı kaynağı (http) güvenilir kaynak olarak eklenir. */
export const PROD_AUTH_URL = `https://localhost:${PROD_PORT}`;
/** Sahte kamera akışı: test, gerçek rezervasyon belirteciyle bu dosyanın üstüne yazar (`e2e/.auth` git dışıdır). */
export const FAKE_CAMERA_FILE = "e2e/.auth/fake-camera.y4m";
