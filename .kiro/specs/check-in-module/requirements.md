# Requirements Document

## Introduction

EventFlow PRO Check-in Modülü, kapı görevlilerinin (door staff) etkinlik girişlerini yönetmesini sağlayan mobil-öncelikli PWA modülüdür. QR kod tarama, manuel arama, gerçek zamanlı istatistikler ve offline çalışma desteği ile hızlı ve güvenilir check-in operasyonları sunar. Modül, rezervasyon sisteminden bağımsız olarak çalışabilir ve etkinlik günü operasyonlarına odaklanır.

## Glossary

- **Check_In_System**: Kapı görevlilerinin misafir girişlerini yönettiği ana sistem bileşeni
- **QR_Scanner**: Kamera tabanlı QR kod okuyucu komponenti
- **Manual_Search**: İsim veya telefon ile rezervasyon arama özelliği
- **Event_Stats_Dashboard**: Canlı etkinlik istatistiklerini gösteren panel
- **Check_In_History**: Son check-in işlemlerinin kronolojik listesi
- **Offline_Queue**: İnternet bağlantısı olmadığında check-in işlemlerini saklayan kuyruk
- **Table_Locator**: Misafirin masasını harita üzerinde gösteren görsel rehber
- **Door_Staff**: Check-in modülünü kullanan kapı görevlisi kullanıcısı
- **Guest_Card**: Misafir bilgilerini ve check-in durumunu gösteren kart komponenti
- **Sound_Feedback**: Check-in başarı/hata durumlarında çalan sesli bildirim
- **VIP_Indicator**: VIP müşterileri vurgulayan görsel işaret
- **Blacklist_Warning**: Kara listedeki müşteriler için uyarı göstergesi

## Requirements

### Requirement 1: Event Selection

**User Story:** As a door staff, I want to select an active event, so that I can manage check-ins for the correct event.

#### Acceptance Criteria

1. WHEN the Door_Staff opens the Check_In_System THEN the system SHALL display a list of today's active events
2. WHEN an event is selected THEN the Check_In_System SHALL load the event's reservations and display the Event_Stats_Dashboard
3. WHEN no active events exist for today THEN the Check_In_System SHALL display a message indicating no events are scheduled
4. WHEN the Door_Staff switches events THEN the Check_In_System SHALL clear the current context and load the new event data
5. WHEN an event is selected THEN the Check_In_System SHALL cache the event data for offline access

### Requirement 2: QR Code Check-in

**User Story:** As a door staff, I want to scan QR codes to check-in guests, so that I can process entries quickly and accurately.

#### Acceptance Criteria

1. WHEN the QR_Scanner reads a valid QR code THEN the Check_In_System SHALL decode the reservation data and display the Guest_Card
2. WHEN a valid QR code is scanned THEN the Check_In_System SHALL show guest name, table label, guest count, and VIP status
3. WHEN the Door_Staff confirms check-in THEN the Check_In_System SHALL update the reservation status to checked_in
4. WHEN check-in is successful THEN the Check_In_System SHALL play a success Sound_Feedback and show the Table_Locator
5. WHEN an invalid or unrecognized QR code is scanned THEN the Check_In_System SHALL display an error message and play error Sound_Feedback
6. WHEN a QR code for a different event is scanned THEN the Check_In_System SHALL reject the check-in with a clear error message
7. WHEN the camera permission is denied THEN the Check_In_System SHALL display instructions to enable camera access

### Requirement 3: Duplicate and Invalid Check-in Handling

**User Story:** As a door staff, I want to be warned about duplicate or invalid check-ins, so that I can prevent unauthorized entries.

#### Acceptance Criteria

1. WHEN an already checked-in QR code is scanned THEN the Check_In_System SHALL display a warning with the original check-in time
2. WHEN a cancelled reservation QR code is scanned THEN the Check_In_System SHALL display the cancellation status and reject check-in
3. WHEN a no_show reservation QR code is scanned THEN the Check_In_System SHALL allow check-in with a confirmation prompt
4. WHEN a blacklisted customer's QR code is scanned THEN the Check_In_System SHALL display a prominent Blacklist_Warning
5. WHEN a VIP customer's QR code is scanned THEN the Check_In_System SHALL display the VIP_Indicator prominently

### Requirement 4: Manual Search Check-in

**User Story:** As a door staff, I want to search for reservations manually, so that I can check-in guests who forgot their QR code.

#### Acceptance Criteria

1. WHEN the Door_Staff enters a guest name THEN the Manual_Search SHALL return matching reservations with partial name matching
2. WHEN the Door_Staff enters a phone number THEN the Manual_Search SHALL return reservations matching the phone digits
3. WHEN search results are displayed THEN the Check_In_System SHALL show guest name, table label, guest count, and status for each result
4. WHEN a search result is selected THEN the Check_In_System SHALL display the full Guest_Card with check-in option
5. WHEN no results are found THEN the Manual_Search SHALL display a message suggesting to verify the information
6. WHEN searching THEN the Manual_Search SHALL filter results to only show the currently selected event's reservations

### Requirement 5: Real-time Statistics Dashboard

**User Story:** As a door staff, I want to see real-time event statistics, so that I can monitor attendance and remaining capacity.

#### Acceptance Criteria

1. WHILE an event is active THEN the Event_Stats_Dashboard SHALL display total expected guests, checked-in count, and remaining count
2. WHEN a check-in occurs THEN the Event_Stats_Dashboard SHALL update statistics within 2 seconds via WebSocket
3. WHEN viewing the dashboard THEN the Event_Stats_Dashboard SHALL show check-in percentage as a progress indicator
4. WHEN the dashboard is displayed THEN the Event_Stats_Dashboard SHALL show cancelled and no-show counts separately
5. WHEN another Door_Staff performs a check-in THEN the Event_Stats_Dashboard SHALL reflect the update in real-time

### Requirement 6: Check-in History

**User Story:** As a door staff, I want to see recent check-in history, so that I can track entries and verify recent operations.

#### Acceptance Criteria

1. WHEN viewing the Check_In_History THEN the Check_In_System SHALL display the last 20 check-ins in chronological order
2. WHEN a check-in is performed THEN the Check_In_History SHALL add the new entry at the top of the list
3. WHEN viewing a history entry THEN the Check_In_System SHALL show guest name, table label, check-in time, and guest count
4. WHEN a history entry is tapped THEN the Check_In_System SHALL display the full Guest_Card with table location
5. WHEN the history is refreshed THEN the Check_In_System SHALL fetch the latest check-ins from the server

### Requirement 7: Table Location Guidance

**User Story:** As a door staff, I want to show guests their table location, so that I can help them find their seats.

#### Acceptance Criteria

1. WHEN check-in is successful THEN the Table_Locator SHALL display the venue map with the guest's table highlighted
2. WHEN displaying the table location THEN the Table_Locator SHALL show the table label prominently
3. WHEN the venue has multiple sections THEN the Table_Locator SHALL indicate which section the table is in
4. WHEN the Door_Staff dismisses the Table_Locator THEN the Check_In_System SHALL return to the scanner view
5. WHEN the table location is shown THEN the Table_Locator SHALL provide a shareable direction text for the guest

### Requirement 8: Offline Support

**User Story:** As a door staff, I want to perform check-ins when offline, so that I can continue operations during network issues.

#### Acceptance Criteria

1. WHILE the device is offline THEN the Check_In_System SHALL queue check-in operations in the Offline_Queue
2. WHEN connection is restored THEN the Offline_Queue SHALL automatically sync pending check-ins with the server
3. WHEN operating offline THEN the Check_In_System SHALL display an offline indicator prominently
4. WHEN a check-in is queued offline THEN the Check_In_System SHALL show a pending sync status on the Guest_Card
5. WHEN sync completes THEN the Check_In_System SHALL update the local state and notify the Door_Staff
6. WHEN offline THEN the Check_In_System SHALL use cached event data for QR code validation

### Requirement 9: Sound and Visual Feedback

**User Story:** As a door staff, I want clear audio and visual feedback, so that I can quickly understand check-in results in a noisy environment.

#### Acceptance Criteria

1. WHEN check-in is successful THEN the Sound_Feedback SHALL play a distinct success tone
2. WHEN check-in fails THEN the Sound_Feedback SHALL play a distinct error tone
3. WHEN a VIP guest checks in THEN the Sound_Feedback SHALL play a special VIP tone
4. WHEN a duplicate check-in is attempted THEN the Sound_Feedback SHALL play a warning tone
5. WHEN the Door_Staff disables sound THEN the Check_In_System SHALL rely only on visual feedback
6. WHEN check-in is successful THEN the Check_In_System SHALL display a green success animation
7. WHEN check-in fails THEN the Check_In_System SHALL display a red error animation

### Requirement 10: Mobile-First PWA Experience

**User Story:** As a door staff, I want a mobile-optimized interface, so that I can use the check-in system efficiently on my phone.

#### Acceptance Criteria

1. WHEN the Check_In_System is accessed on mobile THEN the interface SHALL be optimized for one-handed operation
2. WHEN the PWA is installed THEN the Check_In_System SHALL work as a standalone app without browser chrome
3. WHEN the device is rotated THEN the Check_In_System SHALL adapt the layout appropriately
4. WHEN the screen is small THEN the Check_In_System SHALL prioritize the QR scanner and essential information
5. WHEN the app is launched THEN the Check_In_System SHALL load within 3 seconds on 3G connection
6. WHEN the Door_Staff swipes down THEN the Check_In_System SHALL refresh the current view

### Requirement 11: Walk-in Guest Registration

**User Story:** As a door staff, I want to register walk-in guests, so that I can accommodate guests without reservations.

#### Acceptance Criteria

1. WHEN a walk-in guest arrives THEN the Check_In_System SHALL provide a quick registration form
2. WHEN registering a walk-in THEN the Check_In_System SHALL require guest name and guest count
3. WHEN a walk-in is registered THEN the Check_In_System SHALL create a reservation with immediate checked_in status
4. WHEN registering a walk-in THEN the Check_In_System SHALL allow table selection from available tables
5. WHEN a walk-in is registered THEN the Check_In_System SHALL optionally capture phone number for future contact
6. WHEN a walk-in is registered THEN the Check_In_System SHALL update the Event_Stats_Dashboard immediately

### Requirement 12: Guest Count Verification

**User Story:** As a door staff, I want to verify and update guest counts, so that I can ensure accurate attendance tracking.

#### Acceptance Criteria

1. WHEN checking in a guest THEN the Check_In_System SHALL display the expected guest count from the reservation
2. WHEN the actual guest count differs THEN the Check_In_System SHALL allow the Door_Staff to update the count
3. WHEN guest count is updated THEN the Check_In_System SHALL validate against table capacity
4. WHEN guest count exceeds capacity THEN the Check_In_System SHALL display a warning but allow override with confirmation
5. WHEN guest count is updated THEN the Event_Stats_Dashboard SHALL reflect the change immediately
