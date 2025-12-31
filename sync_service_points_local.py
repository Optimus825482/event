#!/usr/bin/env python3
"""
Service Points ve Staff Assignments'ları Local DB'ye Senkronize Et
"""

import psycopg2

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'eventflow',
    'user': 'postgres',
    'password': '518518Erkan'
}

EVENT_ID = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'

# Service Points
SERVICE_POINTS = [
    ('4ea7a4b7-2547-4017-bb06-305aa6d6ce4d', 'DEPO BAR', 'bar', 4, ['barman','garson'], 100, 600, '#06b6d4', 0),
    ('b53142cf-23e3-4f47-8080-0cad35d5b710', 'CASINO YANİ BAR', 'bar', 4, ['barman'], 260, 600, '#06b6d4', 1),
    ('29073f18-817b-4726-8857-602dab7b4726', 'LOCA 2 FUAYE BAR', 'bar', 4, ['barman','garson'], 420, 600, '#22c55e', 2),
]

# Staff Assignments (service_point_id, staff_id, role, shift_start, shift_end, sort_order)
STAFF_ASSIGNMENTS = [
    # DEPO BAR
    ('4ea7a4b7-2547-4017-bb06-305aa6d6ce4d', 'c366b216-4ddb-420d-8701-2fbb0c5d51c1', 'barman', '12:00', '06:00', 1),  # İrfan Kemal Doğanbey
    ('4ea7a4b7-2547-4017-bb06-305aa6d6ce4d', '2dc56e70-0690-4f7e-aeba-8f906a2fd77f', 'barman', '12:00', '06:00', 2),  # Halit Şahin
    ('4ea7a4b7-2547-4017-bb06-305aa6d6ce4d', '281fa1ca-a00f-42a0-9ba9-af9bbbb5e603', 'barman', '12:00', '00:00', 3),  # Beytullah Çağlar
    ('4ea7a4b7-2547-4017-bb06-305aa6d6ce4d', '706d0e5a-c5a1-4979-9894-67bca021ec09', 'barman', '16:00', '06:00', 4),  # Cihan Kalfa
    # CASINO YANİ BAR
    ('b53142cf-23e3-4f47-8080-0cad35d5b710', '0315ba99-9d8f-4de8-afd0-96843d2058dc', 'barman', '12:00', '06:00', 1),  # Devran Korkut
    ('b53142cf-23e3-4f47-8080-0cad35d5b710', '1da38caa-4d84-419e-8f84-5cb2ca8846e0', 'barman', '12:00', '06:00', 2),  # Yusuf Batıhan
    ('b53142cf-23e3-4f47-8080-0cad35d5b710', '4551f31b-11f0-4c95-b626-64a0a88eccb6', 'barman', '12:00', '00:00', 3),  # Emir Aydınlıoğlu
    ('b53142cf-23e3-4f47-8080-0cad35d5b710', 'a7be2027-14c5-4476-a028-daf46b98e074', 'barman', '16:00', '06:00', 4),  # Kardelen Özdemir
    # LOCA 2 FUAYE BAR
    ('29073f18-817b-4726-8857-602dab7b4726', 'dc954715-0951-48d2-abec-5c2cf0ede9be', 'barman', '16:00', '06:00', 1),  # Melih Eser
    ('29073f18-817b-4726-8857-602dab7b4726', 'da758a74-ab1b-4e3f-a8ba-1463b91dd7ce', 'barman', '12:00', '06:00', 2),  # Burak Önalan
    ('29073f18-817b-4726-8857-602dab7b4726', '7b0436d4-428e-49af-9f90-f2afc55a04b5', 'barman', '20:00', '00:00', 3),  # İskender Ayyıldız
    ('29073f18-817b-4726-8857-602dab7b4726', 'c29276ab-4948-4cc4-86af-11bc5f329411', 'barman', '12:00', '06:00', 4),  # Selim Sata
]

def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    print("=" * 60)
    print("SERVICE POINTS - LOCAL DB SYNC")
    print("=" * 60)
    
    # Mevcut service points ve assignments'ları temizle
    cursor.execute('DELETE FROM service_point_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
    cursor.execute('DELETE FROM service_points WHERE "eventId" = %s', (EVENT_ID,))
    print("✓ Mevcut veriler temizlendi")
    
    # Service Points ekle
    for sp_id, name, point_type, required_staff, allowed_roles, x, y, color, sort_order in SERVICE_POINTS:
        cursor.execute('''
            INSERT INTO service_points (id, "eventId", name, "pointType", "requiredStaffCount", "allowedRoles", x, y, color, shape, "sortOrder", "isActive", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'square', %s, true, NOW(), NOW())
        ''', (sp_id, EVENT_ID, name, point_type, required_staff, allowed_roles, x, y, color, sort_order))
    print(f"✓ {len(SERVICE_POINTS)} service point eklendi")
    
    # Staff Assignments ekle
    for sp_id, staff_id, role, shift_start, shift_end, sort_order in STAFF_ASSIGNMENTS:
        cursor.execute('''
            INSERT INTO service_point_staff_assignments ("eventId", "servicePointId", "staffId", role, "shiftStart", "shiftEnd", "sortOrder", "isActive", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, true, NOW(), NOW())
        ''', (EVENT_ID, sp_id, staff_id, role, shift_start, shift_end, sort_order))
    print(f"✓ {len(STAFF_ASSIGNMENTS)} staff assignment eklendi")
    
    conn.commit()
    
    # Sonuç
    cursor.execute('SELECT COUNT(*) FROM service_points WHERE "eventId" = %s', (EVENT_ID,))
    sp_count = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(*) FROM service_point_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
    assign_count = cursor.fetchone()[0]
    
    print(f"\nÖZET: {sp_count} service point, {assign_count} staff assignment")
    
    cursor.close()
    conn.close()
    print("✓ İşlem tamamlandı!")

if __name__ == "__main__":
    main()
