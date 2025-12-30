# Design Document: PWA Conversion

## Overview

EventFlow PRO uygulamasının Progressive Web App (PWA) olarak dönüştürülmesi için teknik tasarım. Bu tasarım, Next.js 16 ve @ducanh2912/next-pwa kütüphanesi kullanılarak modern PWA standartlarına uygun bir implementasyon sağlayacaktır.

### Hedefler

- Mobil cihazlarda native uygulama deneyimi
- Offline çalışabilirlik
- Hızlı yükleme süreleri (< 2.5s LCP)
- Lighthouse PWA skoru 90+
- Cihaza kurulabilirlik

### Teknoloji Seçimleri

- **PWA Framework**: @ducanh2912/next-pwa (Workbox tabanlı)
- **Cache Storage**: Browser Cache API
- **Offline Storage**: IndexedDB (idb kütüphanesi zaten mevcut)
- **State Management**: Zustand (mevcut)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Next.js   │  │   Service   │  │      Cache Storage      │ │
│  │     App     │◄─┤   Worker    │◄─┤  ┌─────┐ ┌─────┐ ┌────┐│ │
│  │             │  │  (Workbox)  │  │  │Static│ │ API │ │Img ││ │
│  └─────────────┘  └─────────────┘  │  │Cache │ │Cache│ │Cache│ │
│         │                │         │  └─────┘ └─────┘ └────┘│ │
│         │                │         └─────────────────────────┘ │
│         ▼                ▼                                      │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │  IndexedDB  │  │   Network   │                              │
│  │ (Offline Q) │  │   Requests  │                              │
│  └─────────────┘  └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
┌──────────┐     ┌───────────────┐     ┌─────────────┐     ┌────────┐
│  Client  │────▶│ Service Worker│────▶│ Cache Check │────▶│ Network│
└──────────┘     └───────────────┘     └─────────────┘     └────────┘
                        │                     │                  │
                        │              ┌──────┴──────┐           │
                        │              │             │           │
                        │         Cache Hit    Cache Miss        │
                        │              │             │           │
                        │              ▼             ▼           │
                        │        Return Cache   Fetch & Cache    │
                        │              │             │           │
                        └──────────────┴─────────────┴───────────┘
```

## Components and Interfaces

### 1. Web App Manifest (manifest.json)

```json
{
  "name": "EventFlow PRO - Etkinlik Yönetim Sistemi",
  "short_name": "EventFlow",
  "description": "Yeni nesil etkinlik yönetim, planlama ve deneyim ekosistemi",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#0f172a",
  "background_color": "#0f172a",
  "categories": ["business", "productivity"],
  "icons": [
    {
      "src": "/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### 2. Next.js PWA Configuration

```typescript
// next.config.ts
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cacheStartUrl: true,
  dynamicStartUrl: true,
  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    runtimeCaching: [
      // Static assets - Cache First
      {
        urlPattern: /^https:\/\/.*\.(js|css|woff2?)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          },
        },
      },
      // Images - Cache First with shorter expiration
      {
        urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "images",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      // API requests - Stale While Revalidate
      {
        urlPattern: /^https:\/\/.*\/api\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "api-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
};

export default withPWA(nextConfig);
```

### 3. PWA Hooks Interface

```typescript
// hooks/usePWA.ts
interface PWAState {
  isInstalled: boolean;
  isOnline: boolean;
  canInstall: boolean;
  isUpdateAvailable: boolean;
}

interface PWAActions {
  promptInstall: () => Promise<void>;
  dismissInstallPrompt: () => void;
  updateServiceWorker: () => void;
}

type UsePWAReturn = PWAState & PWAActions;
```

### 4. Install Prompt Store

```typescript
// store/pwa-store.ts
interface PWAStore {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallBannerVisible: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  lastDismissed: number | null;

  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  showInstallBanner: () => void;
  hideInstallBanner: () => void;
  setInstalled: (installed: boolean) => void;
  setOnline: (online: boolean) => void;
  dismissBanner: () => void;
}
```

### 5. Offline Indicator Component

```typescript
// components/pwa/OfflineIndicator.tsx
interface OfflineIndicatorProps {
  className?: string;
}

// Renders a banner when offline
// Auto-hides when back online
// Shows sync status for queued actions
```

### 6. Install Banner Component

```typescript
// components/pwa/InstallBanner.tsx
interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

// Shows custom install prompt
// Respects 7-day dismiss cooldown
// Triggers native install dialog
```

## Data Models

### BeforeInstallPromptEvent (Browser API)

```typescript
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}
```

### PWA Storage Schema (localStorage)

```typescript
interface PWALocalStorage {
  "pwa-install-dismissed": number; // timestamp
  "pwa-installed": boolean;
}
```

### Offline Queue Schema (IndexedDB)

```typescript
interface OfflineQueueItem {
  id: string;
  url: string;
  method: string;
  body?: string;
  headers: Record<string, string>;
  timestamp: number;
  retryCount: number;
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Manifest Schema Validation

_For any_ valid manifest.json file, it SHALL contain all required PWA fields (name, short_name, start_url, display, icons) with correct types and values.
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11**

### Property 2: Cache Strategy Correctness

_For any_ network request intercepted by the service worker, the correct caching strategy SHALL be applied based on the request URL pattern (Cache First for static assets, Stale While Revalidate for API, Network First for documents).
**Validates: Requirements 2.4, 2.5, 2.6, 2.7, 7.1, 7.2, 7.3, 7.4**

### Property 3: Metadata Presence Validation

_For any_ rendered HTML page, the document head SHALL contain all required PWA meta tags (manifest link, theme-color, apple-touch-icon, apple-mobile-web-app-capable).
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 4: Online/Offline State Detection

_For any_ change in network connectivity, the system SHALL correctly detect and reflect the online/offline state within 1 second.
**Validates: Requirements 8.1, 8.2, 8.3**

### Property 5: Cache Limit Enforcement

_For any_ cache storage, when the entry count exceeds the configured limit, the oldest entries SHALL be evicted following LRU policy.
**Validates: Requirements 7.5, 7.6, 7.7**

## Error Handling

### Service Worker Registration Errors

```typescript
// Graceful degradation when SW registration fails
try {
  await navigator.serviceWorker.register("/sw.js");
} catch (error) {
  console.warn("Service Worker registration failed:", error);
  // App continues to work without offline support
}
```

### Cache Storage Errors

```typescript
// Handle quota exceeded errors
try {
  await cache.put(request, response);
} catch (error) {
  if (error.name === "QuotaExceededError") {
    // Clear old caches and retry
    await clearOldCaches();
    await cache.put(request, response);
  }
}
```

### Offline Queue Errors

```typescript
// Retry logic with exponential backoff
const retryRequest = async (item: OfflineQueueItem) => {
  const maxRetries = 3;
  const baseDelay = 1000;

  if (item.retryCount >= maxRetries) {
    // Remove from queue and notify user
    await removeFromQueue(item.id);
    notifyUser("İşlem başarısız oldu");
    return;
  }

  const delay = baseDelay * Math.pow(2, item.retryCount);
  await sleep(delay);
  // Retry request...
};
```

## Testing Strategy

### Unit Tests

- PWA store state management
- Online/offline detection hook
- Install prompt logic
- Cache key generation

### Property-Based Tests

- Manifest schema validation (Property 1)
- Cache strategy selection (Property 2)
- Metadata presence (Property 3)
- Online/offline state transitions (Property 4)

### Integration Tests

- Service worker registration
- Cache storage operations
- Offline fallback rendering
- Install banner display logic

### E2E Tests

- Full offline workflow
- Install prompt flow
- Cache update on new deployment

### Testing Framework

- **Unit/Property Tests**: Vitest with fast-check for property-based testing
- **E2E Tests**: Playwright with PWA support
- **Lighthouse CI**: Automated PWA score validation

### Test Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```
