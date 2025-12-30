import { openDB, DBSchema, IDBPDatabase } from "idb";
import { usePWAStore } from "@/store/pwa-store";

// Database schema
interface OfflineQueueDB extends DBSchema {
  "offline-queue": {
    key: string;
    value: OfflineQueueItem;
    indexes: { "by-timestamp": number };
  };
}

// Queue item interface
export interface OfflineQueueItem {
  id: string;
  url: string;
  method: string;
  body?: string;
  headers: Record<string, string>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

// Database instance
let db: IDBPDatabase<OfflineQueueDB> | null = null;

// Initialize database
async function getDB(): Promise<IDBPDatabase<OfflineQueueDB>> {
  if (db) return db;

  db = await openDB<OfflineQueueDB>("eventflow-offline", 1, {
    upgrade(database) {
      const store = database.createObjectStore("offline-queue", {
        keyPath: "id",
      });
      store.createIndex("by-timestamp", "timestamp");
    },
  });

  return db;
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Add request to queue
export async function addToQueue(
  url: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<string> {
  const database = await getDB();

  const item: OfflineQueueItem = {
    id: generateId(),
    url,
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: 3,
  };

  await database.add("offline-queue", item);

  // Update pending sync count
  usePWAStore.getState().incrementPendingSync();

  return item.id;
}

// Get all queued items
export async function getQueuedItems(): Promise<OfflineQueueItem[]> {
  const database = await getDB();
  return database.getAllFromIndex("offline-queue", "by-timestamp");
}

// Get queue count
export async function getQueueCount(): Promise<number> {
  const database = await getDB();
  return database.count("offline-queue");
}

// Remove item from queue
export async function removeFromQueue(id: string): Promise<void> {
  const database = await getDB();
  await database.delete("offline-queue", id);

  // Update pending sync count
  usePWAStore.getState().decrementPendingSync();
}

// Update item retry count
export async function updateRetryCount(
  id: string,
  retryCount: number
): Promise<void> {
  const database = await getDB();
  const item = await database.get("offline-queue", id);

  if (item) {
    item.retryCount = retryCount;
    await database.put("offline-queue", item);
  }
}

// Clear all queued items
export async function clearQueue(): Promise<void> {
  const database = await getDB();
  await database.clear("offline-queue");

  // Reset pending sync count
  usePWAStore.getState().setPendingSyncCount(0);
}

// Process queue - retry all pending requests
export async function processQueue(): Promise<{
  success: number;
  failed: number;
}> {
  const items = await getQueuedItems();
  let success = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...item.headers,
        },
        body: item.body,
      });

      if (response.ok) {
        await removeFromQueue(item.id);
        success++;
      } else if (response.status >= 400 && response.status < 500) {
        // Client error - don't retry
        await removeFromQueue(item.id);
        failed++;
      } else {
        // Server error - increment retry count
        const newRetryCount = item.retryCount + 1;
        if (newRetryCount >= item.maxRetries) {
          await removeFromQueue(item.id);
          failed++;
        } else {
          await updateRetryCount(item.id, newRetryCount);
        }
      }
    } catch (error) {
      // Network error - increment retry count
      const newRetryCount = item.retryCount + 1;
      if (newRetryCount >= item.maxRetries) {
        await removeFromQueue(item.id);
        failed++;
      } else {
        await updateRetryCount(item.id, newRetryCount);
      }
    }
  }

  return { success, failed };
}

// Exponential backoff delay
export function getBackoffDelay(retryCount: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  // Add jitter
  return delay + Math.random() * 1000;
}

// Initialize queue count on app start
export async function initializeQueueCount(): Promise<void> {
  const count = await getQueueCount();
  usePWAStore.getState().setPendingSyncCount(count);
}
