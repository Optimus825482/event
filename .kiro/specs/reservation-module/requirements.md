# Requirements Document

## Introduction

EventFlow PRO sisteminin ikinci ana modülü olan Rezervasyon Modülü, etkinlik organizatörlerinin masa rezervasyonlarını yönetmesini, QR kod tabanlı biletleme sistemini ve check-in operasyonlarını kapsar. Bu modül, müşteri bilgilerini CRM sistemiyle entegre ederek VIP analizi ve müşteri geçmişi takibi sağlar. Ayrıca kapı görevlileri için mobil PWA arayüzü ile gerçek zamanlı check-in işlemleri gerçekleştirir.

## Glossary

- **Reservation_System**: Masa rezervasyonlarını oluşturan, güncelleyen ve takip eden ana sistem bileşeni
- **QR_Engine**: Benzersiz QR kodları üreten ve doğrulayan biletleme motoru
- **Check_In_Module**: Kapı görevlilerinin QR kod okutarak misafir girişi yaptığı mobil PWA modülü
- **CRM_Integration**: Müşteri bilgilerini ve geçmişini yöneten entegrasyon katmanı
- **Real_Time_Dashboard**: Canlı etkinlik istatistiklerini gösteren kontrol paneli
- **Table_Instance**: Canvas üzerindeki bir masa nesnesi
- **Guest_Count**: Bir rezervasyondaki misafir sayısı
- **QR_Code_Hash**: Rezervasyona ait benzersiz şifrelenmiş QR kod değeri
- **Reservation_Status**: Rezervasyonun durumu (pending, confirmed, checked_in, cancelled, no_show)

## Requirements

### Requirement 1

**User Story:** As an organizer, I want to create reservations for tables, so that I can manage guest seating for events.

#### Acceptance Criteria

1. WHEN an organizer selects a table and enters customer information THEN the Reservation_System SHALL create a new reservation with pending status
2. WHEN a reservation is created THEN the Reservation_System SHALL validate that the Guest_Count does not exceed the Table_Instance capacity
3. WHEN a reservation is created for an already reserved table THEN the Reservation_System SHALL reject the request and display an error message
4. WHEN a reservation is successfully created THEN the QR_Engine SHALL generate a unique QR_Code_Hash for that reservation
5. WHEN a reservation is created THEN the Reservation_System SHALL associate the reservation with the selected Customer from CRM_Integration

### Requirement 2

**User Story:** As an organizer, I want to update and manage existing reservations, so that I can handle changes and cancellations.

#### Acceptance Criteria

1. WHEN an organizer updates a reservation's Guest_Count THEN the Reservation_System SHALL validate the new count against Table_Instance capacity
2. WHEN an organizer changes the table assignment THEN the Reservation_System SHALL verify the new table is available and update the reservation
3. WHEN an organizer cancels a reservation THEN the Reservation_System SHALL update the Reservation_Status to cancelled and free the table
4. WHEN a reservation is updated THEN the Reservation_System SHALL preserve the original QR_Code_Hash
5. WHEN an organizer marks a reservation as no_show THEN the Reservation_System SHALL update the status and log the event for CRM_Integration

### Requirement 3

**User Story:** As an organizer, I want to generate and send QR tickets to customers, so that they can use them for check-in.

#### Acceptance Criteria

1. WHEN a QR code is requested for a reservation THEN the QR_Engine SHALL generate a data URL containing encrypted reservation data
2. WHEN generating QR code content THEN the QR_Engine SHALL include eventId, tableId, and QR_Code_Hash in encrypted format
3. WHEN a QR code is generated THEN the Reservation_System SHALL provide options to send via SMS or email
4. WHEN the same QR code is requested multiple times THEN the QR_Engine SHALL return consistent output for the same reservation

### Requirement 4

**User Story:** As a door staff, I want to scan QR codes and check-in guests, so that I can manage event entry efficiently.

#### Acceptance Criteria

1. WHEN a valid QR code is scanned THEN the Check_In_Module SHALL verify the QR_Code_Hash and display reservation details
2. WHEN check-in is performed THEN the Check_In_Module SHALL update Reservation_Status to checked_in and record the check-in time
3. WHEN an already checked-in QR code is scanned THEN the Check_In_Module SHALL display a warning that the guest has already entered
4. WHEN a cancelled reservation QR code is scanned THEN the Check_In_Module SHALL reject the check-in and display cancellation status
5. WHEN check-in is successful THEN the Check_In_Module SHALL display table location with visual guidance on the venue map

### Requirement 5

**User Story:** As a door staff, I want to see real-time event statistics, so that I can monitor attendance and remaining capacity.

#### Acceptance Criteria

1. WHILE an event is active THEN the Real_Time_Dashboard SHALL display total expected guests, checked-in count, and remaining count
2. WHEN a check-in occurs THEN the Real_Time_Dashboard SHALL update statistics within 2 seconds
3. WHEN viewing the dashboard THEN the Real_Time_Dashboard SHALL show recent check-in history with customer names and table assignments
4. WHILE the device is offline THEN the Check_In_Module SHALL queue check-in operations and sync when connection is restored

### Requirement 6

**User Story:** As an organizer, I want to see customer history and warnings during reservation, so that I can provide better service and avoid issues.

#### Acceptance Criteria

1. WHEN a customer is selected for reservation THEN the CRM_Integration SHALL display the customer's event history and VIP score
2. WHEN a blacklisted customer is selected THEN the CRM_Integration SHALL display a prominent warning to the organizer
3. WHEN a customer has special tags THEN the CRM_Integration SHALL display relevant tags (vegan, big_spender, prefers_front) during reservation
4. WHEN a customer had previous complaints THEN the CRM_Integration SHALL suggest appropriate table placement based on history

### Requirement 7

**User Story:** As an organizer, I want to search and filter reservations, so that I can quickly find specific bookings.

#### Acceptance Criteria

1. WHEN an organizer searches by customer name THEN the Reservation_System SHALL return matching reservations with partial name matching
2. WHEN an organizer searches by phone number THEN the Reservation_System SHALL return reservations matching the phone digits
3. WHEN an organizer filters by Reservation_Status THEN the Reservation_System SHALL display only reservations with the selected status
4. WHEN an organizer filters by event THEN the Reservation_System SHALL display only reservations for the selected event
5. WHEN search results are displayed THEN the Reservation_System SHALL show customer name, table label, guest count, and status for each result

### Requirement 8

**User Story:** As an organizer, I want to view reservations on the canvas, so that I can see the visual distribution of bookings.

#### Acceptance Criteria

1. WHEN viewing the event canvas THEN the Reservation_System SHALL highlight reserved tables with a distinct visual indicator
2. WHEN clicking a reserved table on canvas THEN the Reservation_System SHALL display the reservation details in a panel
3. WHEN a table has a reservation THEN the Reservation_System SHALL display the customer name and guest count on the table shape
4. WHEN check-in status changes THEN the Reservation_System SHALL update the table visual indicator in real-time
