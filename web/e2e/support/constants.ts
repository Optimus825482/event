export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DB_NAME = "eventflow_e2e";
export const PG_BASE_URL = "postgres://postgres@localhost:54329";
export const E2E_DATABASE_URL = `${PG_BASE_URL}/${E2E_DB_NAME}`;
export const ADMIN_USERNAME = "e2e-admin";
export const AUTH_STATE_FILE = "e2e/.auth/admin.json";

/** Üretim derlemesi (service worker yalnızca burada kayıtlı): kendi portu, kendi distDir'i. */
export const PROD_PORT = 3101;
export const PROD_BASE_URL = `http://localhost:${PROD_PORT}`;
export const PROD_DIST_DIR = ".next-e2e/prod";
/** Üretim modu https:// BETTER_AUTH_URL ister; tarayıcı kaynağı (http) güvenilir kaynak olarak eklenir. */
export const PROD_AUTH_URL = `https://localhost:${PROD_PORT}`;
/** Sahte kamera akışı: test, gerçek rezervasyon belirteciyle bu dosyanın üstüne yazar (`e2e/.auth` git dışıdır). */
export const FAKE_CAMERA_FILE = "e2e/.auth/fake-camera.y4m";
