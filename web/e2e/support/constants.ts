export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DB_NAME = "eventflow_e2e";
export const PG_BASE_URL = "postgres://postgres@localhost:54329";
export const E2E_DATABASE_URL = `${PG_BASE_URL}/${E2E_DB_NAME}`;
export const ADMIN_USERNAME = "e2e-admin";
export const AUTH_STATE_FILE = "e2e/.auth/admin.json";
