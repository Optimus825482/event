import { setupTestDb } from "./helpers/db";

export default async function globalSetup(): Promise<void> {
  await setupTestDb();
}
