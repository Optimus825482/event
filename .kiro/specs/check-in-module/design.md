# Design Document: Check-in Module

## Overview

Check-in Modülü, EventFlow PRO sisteminin kapı operasyonlarını yöneten mobil-öncelikli PWA modülüdür. Bu modül, mevcut rezervasyon sisteminin check-in endpoint'lerini kullanarak kapı görevlilerine hızlı, güvenilir ve offline-destekli bir check-in deneyimi sunar.

### Temel Özellikler

- QR kod tarama ile hızlı check-in
- Manuel isim/telefon araması
- Gerçek zamanlı istatistik dashboard'u
- Offline çalışma desteği
- Walk-in misafir kaydı
- Sesli ve görsel geri bildirim

### Teknoloji Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **State Management**: Zustand
- **QR Scanner**: html5-qrcode
- **Real-time**: Socket.io client
- **Offline**: IndexedDB (idb), Service Worker
- **Backend**: Mevcut NestJS API (reservations, events modülleri)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Check-in Module (PWA)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Scanner   │  │   Search    │  │   Stats     │              │
│  │    View     │  │    View     │  │  Dashboard  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│  ┌──────┴────────────────┴────────────────┴──────┐              │
│  │              Check-in Store (Zustand)          │              │
│  │  - selectedEvent                               │              │
│  │  - reservations (cached)                       │              │
│  │  - checkInHistory                              │              │
│  │  - eventStats                                  │              │
│  │  - offlineQueue                                │              │
│  └──────────────────────┬────────────────────────┘              │
│                         │                                        │
│  ┌──────────────────────┴────────────────────────┐              │
│  │           Offline Manager (IndexedDB)          │              │
│  │  - Event cache                                 │              │
│  │  - Reservation cache                           │              │
│  │  - Pending check-ins queue                     │              │
│  └──────────────────────┬────────────────────────┘              │
├─────────────────────────┼────────────────────────────────────────┤
│                         │                                        │
│  ┌──────────────────────┴────────────────────────┐              │
│  │              API Layer (api.ts)                │              │
│  │  - checkInApi.getActiveEvents()               │              │
│  │  - checkInApi.checkIn(qrHash)                 │              │
│  │  - checkInApi.search(query, eventId)          │              │
│  │  - checkInApi.getStats(eventId)               │              │
│  │  - checkInApi.registerWalkIn(data)            │              │
│  └──────────────────────┬────────────────────────┘              │
│                         │                                        │
│  ┌──────────────────────┴────────────────────────┐              │
│  │           WebSocket (Socket.io)                │              │
│  │  - check-in-update                            │              │
│  │  - stats-update                               │              │
│  └───────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (NestJS)                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Reservations   │  │     Events      │  │    Realtime     │  │
│  │    Module       │  │     Module      │  │    Gateway      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Page Components

#### CheckInPage (`/check-in/page.tsx`)

Ana check-in sayfası - event seçimi ve check-in operasyonları.

```typescript
interface CheckInPageState {
  selectedEventId: string | null;
  activeTab: "scanner" | "search" | "history" | "walkin";
  isLoading: boolean;
}
```

#### EventSelectorModal

Aktif etkinlik seçim modal'ı.

```typescript
interface EventSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (eventId: string) => void;
  events: ActiveEvent[];
}

interface ActiveEvent {
  id: string;
  name: string;
  eventDate: Date;
  totalCapacity: number;
  checkedInCount: number;
  venueLayout: VenueLayout | null;
}
```

### 2. Feature Components

#### QRScannerPanel

QR kod tarama paneli.

```typescript
interface QRScannerPanelProps {
  eventId: string;
  onCheckInSuccess: (result: CheckInResult) => void;
  onCheckInError: (error: CheckInError) => void;
}

interface CheckInResult {
  success: boolean;
  reservation: Reservation;
  tableLocation: TableLocation | null;
  message: string;
  isVIP: boolean;
  isBlacklisted: boolean;
}

interface CheckInError {
  code:
    | "ALREADY_CHECKED_IN"
    | "CANCELLED"
    | "INVALID_QR"
    | "WRONG_EVENT"
    | "NOT_FOUND";
  message: string;
  originalCheckInTime?: Date;
}
```

#### GuestCard

Misafir bilgi kartı.

```typescript
interface GuestCardProps {
  reservation: Reservation;
  customer: Customer | null;
  tableLocation: TableLocation | null;
  showCheckInButton: boolean;
  onCheckIn: () => void;
  onUpdateGuestCount: (count: number) => void;
}
```

#### ManualSearchPanel

Manuel arama paneli.

```typescript
interface ManualSearchPanelProps {
  eventId: string;
  onSelectReservation: (reservation: Reservation) => void;
}
```

#### EventStatsDashboard

Etkinlik istatistikleri dashboard'u.

```typescript
interface EventStatsDashboardProps {
  eventId: string;
  stats: EventStats;
  isRealtime: boolean;
}

interface EventStats {
  totalExpected: number;
  checkedIn: number;
  remaining: number;
  cancelled: number;
  noShow: number;
  checkInPercentage: number;
}
```

#### CheckInHistoryPanel

Check-in geçmişi paneli.

```typescript
interface CheckInHistoryPanelProps {
  eventId: string;
  history: CheckInHistoryEntry[];
  onSelectEntry: (entry: CheckInHistoryEntry) => void;
}

interface CheckInHistoryEntry {
  reservationId: string;
  guestName: string;
  tableLabel: string;
  guestCount: number;
  checkInTime: Date;
  isVIP: boolean;
}
```

#### TableLocatorModal

Masa konumu gösterici modal.

```typescript
interface TableLocatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableLocation: TableLocation;
  venueLayout: VenueLayout;
}

interface TableLocation {
  tableId: string;
  label: string;
  x: number;
  y: number;
  section?: string;
  directionText: string;
}
```

#### WalkInRegistrationPanel

Walk-in misafir kayıt paneli.

```typescript
interface WalkInRegistrationPanelProps {
  eventId: string;
  availableTables: AvailableTable[];
  onRegister: (data: WalkInData) => void;
}

interface WalkInData {
  guestName: string;
  guestCount: number;
  tableId: string;
  phone?: string;
}

interface AvailableTable {
  id: string;
  label: string;
  capacity: number;
}
```

### 3. UI Components

#### SoundFeedback

Sesli geri bildirim yöneticisi.

```typescript
interface SoundFeedbackConfig {
  enabled: boolean;
  successSound: string;
  errorSound: string;
  vipSound: string;
  warningSound: string;
}
```

#### OfflineIndicator

Çevrimdışı durum göstergesi.

```typescript
interface OfflineIndicatorProps {
  isOffline: boolean;
  pendingCount: number;
  onSync: () => void;
}
```

## Data Models

### Check-in Store (Zustand)

```typescript
interface CheckInStore {
  // State
  selectedEventId: string | null;
  selectedEvent: ActiveEvent | null;
  reservations: Map<string, Reservation>; // qrCodeHash -> Reservation
  eventStats: EventStats | null;
  checkInHistory: CheckInHistoryEntry[];
  offlineQueue: OfflineCheckIn[];
  isOnline: boolean;
  soundEnabled: boolean;

  // Actions
  selectEvent: (eventId: string) => Promise<void>;
  clearEvent: () => void;
  checkIn: (qrCodeHash: string) => Promise<CheckInResult>;
  checkInManual: (reservationId: string) => Promise<CheckInResult>;
  registerWalkIn: (data: WalkInData) => Promise<CheckInResult>;
  searchReservations: (query: string) => Promise<Reservation[]>;
  updateGuestCount: (reservationId: string, count: number) => Promise<void>;
  syncOfflineQueue: () => Promise<void>;
  toggleSound: () => void;

  // Real-time
  subscribeToUpdates: (eventId: string) => void;
  unsubscribeFromUpdates: () => void;
}
```

### Offline Queue Entry

```typescript
interface OfflineCheckIn {
  id: string;
  qrCodeHash: string;
  reservationId: string;
  timestamp: Date;
  guestCountOverride?: number;
  status: "pending" | "syncing" | "synced" | "failed";
  retryCount: number;
  error?: string;
}
```

### IndexedDB Schema

```typescript
// Database: eventflow-checkin
// Version: 1

interface CheckInDB {
  events: {
    key: string; // eventId
    value: {
      event: ActiveEvent;
      reservations: Reservation[];
      cachedAt: Date;
    };
  };
  offlineQueue: {
    key: string; // id
    value: OfflineCheckIn;
    indexes: {
      byStatus: string;
      byTimestamp: Date;
    };
  };
  settings: {
    key: string;
    value: any;
  };
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Event Selection Loads Correct Data

_For any_ selected event, the loaded reservations SHALL only contain reservations belonging to that event, and the stats SHALL accurately reflect the reservation statuses.
**Validates: Requirements 1.2, 1.4**

### Property 2: QR Code Decoding Consistency

_For any_ valid QR code hash, decoding SHALL always return the same reservation data, and the reservation's eventId SHALL match the currently selected event for successful check-in.
**Validates: Requirements 2.1, 2.6**

### Property 3: Check-in State Transition Integrity

_For any_ reservation with status 'confirmed' or 'pending', performing check-in SHALL transition the status to 'checked_in' and set checkInTime to the current timestamp. The transition SHALL be idempotent - checking in an already checked-in reservation SHALL return the original check-in time.
**Validates: Requirements 2.3, 3.1**

### Property 4: Duplicate Check-in Detection

_For any_ reservation that has already been checked in, attempting another check-in SHALL return an error with code 'ALREADY_CHECKED_IN' and include the original checkInTime.
**Validates: Requirements 3.1, 3.2**

### Property 5: Invalid Status Rejection

_For any_ reservation with status 'cancelled', check-in SHALL be rejected with code 'CANCELLED'. For status 'no_show', check-in SHALL require explicit confirmation.
**Validates: Requirements 3.2, 3.3**

### Property 6: VIP and Blacklist Detection

_For any_ reservation with an associated customer, if customer.vipScore > 0 then isVIP SHALL be true, and if customer.isBlacklisted is true then isBlacklisted SHALL be true in the check-in response.
**Validates: Requirements 3.4, 3.5**

### Property 7: Search Result Filtering

_For any_ search query and selected event, all returned reservations SHALL have eventId matching the selected event, and results SHALL include reservations where guestName or guestPhone contains the search query (case-insensitive partial match).
**Validates: Requirements 4.1, 4.2, 4.6**

### Property 8: Event Stats Calculation

_For any_ event, the stats SHALL satisfy: remaining = totalExpected - checkedIn, and totalExpected = count of reservations with status in ['pending', 'confirmed', 'checked_in'], and checkInPercentage = (checkedIn / totalExpected) \* 100.
**Validates: Requirements 5.1, 5.3, 5.4**

### Property 9: Check-in History Ordering

_For any_ event's check-in history, entries SHALL be ordered by checkInTime descending, limited to 20 entries, and each entry SHALL contain guestName, tableLabel, checkInTime, and guestCount.
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 10: Table Location Response

_For any_ successful check-in, the response SHALL include tableLocation with label, x, y coordinates, and directionText. If the venue has sections, section SHALL be included.
**Validates: Requirements 7.2, 7.3, 7.5**

### Property 11: Offline Queue Round-trip

_For any_ check-in performed while offline, the operation SHALL be queued locally. When connection is restored, all queued operations SHALL be synced to the server, and upon successful sync, local state SHALL be updated to reflect server state.
**Validates: Requirements 8.1, 8.2, 8.5, 8.6**

### Property 12: Walk-in Registration Validation

_For any_ walk-in registration, guestName and guestCount SHALL be required. The created reservation SHALL have status 'checked_in' and checkInTime set to creation time. The selected table SHALL be available (no active reservation).
**Validates: Requirements 11.2, 11.3, 11.4**

### Property 13: Guest Count Capacity Validation

_For any_ guest count update, if the new count exceeds table capacity, a warning SHALL be returned but the update SHALL be allowed with explicit confirmation. Stats SHALL be updated to reflect the new total guest count.
**Validates: Requirements 12.3, 12.4, 12.5**

## Error Handling

### Error Codes

| Code                  | HTTP Status | Description                          |
| --------------------- | ----------- | ------------------------------------ |
| `ALREADY_CHECKED_IN`  | 409         | Reservation already checked in       |
| `CANCELLED`           | 400         | Reservation is cancelled             |
| `INVALID_QR`          | 400         | QR code format invalid or corrupted  |
| `WRONG_EVENT`         | 400         | QR code belongs to different event   |
| `NOT_FOUND`           | 404         | Reservation not found                |
| `TABLE_OCCUPIED`      | 409         | Table already has active reservation |
| `CAPACITY_EXCEEDED`   | 400         | Guest count exceeds table capacity   |
| `OFFLINE_SYNC_FAILED` | 500         | Failed to sync offline queue         |

### Error Response Format

```typescript
interface CheckInErrorResponse {
  error: {
    code: string;
    message: string;
    details?: {
      originalCheckInTime?: string;
      reservationStatus?: string;
      tableCapacity?: number;
      requestedCount?: number;
    };
  };
}
```

### Offline Error Recovery

1. **Network Timeout**: Queue operation locally, retry on reconnection
2. **Conflict (409)**: Mark as failed, show user the conflict details
3. **Server Error (5xx)**: Retry with exponential backoff (max 3 attempts)
4. **Validation Error (4xx)**: Mark as failed, require user intervention

## Testing Strategy

### Unit Tests

- Check-in store actions and state transitions
- Stats calculation functions
- QR code validation logic
- Search filtering logic
- Offline queue management

### Property-Based Tests (fast-check)

- **Property 1**: Event data loading correctness
- **Property 3**: Check-in state transition integrity
- **Property 7**: Search result filtering
- **Property 8**: Event stats calculation
- **Property 11**: Offline queue round-trip
- **Property 12**: Walk-in registration validation
- **Property 13**: Guest count capacity validation

### Integration Tests

- QR scanner → API → State update flow
- WebSocket real-time updates
- Offline → Online sync flow
- Walk-in registration flow

### E2E Tests

- Complete check-in flow (scan → confirm → table location)
- Manual search and check-in flow
- Walk-in registration flow
- Offline mode operation

### Test Configuration

- Property tests: minimum 100 iterations
- Use `fast-check` library for property-based testing
- Mock WebSocket for real-time tests
- Use IndexedDB mock for offline tests
