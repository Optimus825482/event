"""
Şevval Erol'u SİBEL CAN CASINO YILBAŞI GALASI etkinliğine garson olarak ata
Sicil: 14251
Masalar: 6,7,8,16,17,18 (Grup 30)
Vardiya: 16:00-00:00

NOT: Foreign key artık staff tablosuna bağlı (users değil)
"""

import psycopg2

# Lokal DB bağlantısı
conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='eventflow',
    user='postgres',
    password='518518Erkan'
)
cur = conn.cursor()

EVENT_ID = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'
STAFF_ID = '758d1a92-c558-4bca-afbf-42c6c1a7d865'  # Şevval Erol
SHIFT_ID = 'a1000001-0000-0000-0000-000000000002'  # 16:00-00:00
TABLE_IDS = ['6','7','8','16','17','18']
ASSIGNMENT_ID = 'e1000001-0000-0000-0000-000000014251'

print("=" * 60)
print("Şevval Erol - Garson Ataması (Lokal DB)")
print("=" * 60)

# 1. Foreign key'i kontrol et ve düzelt
print("\n1. Foreign key kontrolü...")
cur.execute("""
    SELECT constraint_name, table_name 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'FK_5db1bf1644039be35244de9288c'
""")
old_fk = cur.fetchone()

if old_fk:
    print("   Eski FK (users) bulundu, kaldırılıyor...")
    cur.execute('ALTER TABLE event_staff_assignments DROP CONSTRAINT "FK_5db1bf1644039be35244de9288c"')
    conn.commit()
    print("   ✓ Eski FK kaldırıldı")

# Staff tablosunda olmayan atamaları sil
cur.execute("""
    DELETE FROM event_staff_assignments 
    WHERE "staffId" NOT IN (SELECT id FROM staff)
""")
deleted = cur.rowcount
if deleted > 0:
    print(f"   ✓ {deleted} geçersiz atama silindi")
conn.commit()

# Yeni FK ekle (staff tablosuna)
cur.execute("""
    SELECT constraint_name FROM information_schema.table_constraints 
    WHERE constraint_name = 'FK_staff_assignments_staff'
""")
new_fk = cur.fetchone()

if not new_fk:
    print("   Yeni FK (staff) ekleniyor...")
    cur.execute("""
        ALTER TABLE event_staff_assignments 
        ADD CONSTRAINT "FK_staff_assignments_staff" 
        FOREIGN KEY ("staffId") REFERENCES staff(id)
    """)
    conn.commit()
    print("   ✓ Yeni FK eklendi")
else:
    print("   ✓ FK zaten staff tablosuna bağlı")

# 2. Staff tablosunda var mı kontrol et
print("\n2. Staff kontrolü...")
cur.execute('SELECT id, "fullName", "sicilNo" FROM staff WHERE "sicilNo" = %s', ('14251',))
staff = cur.fetchone()

if not staff:
    print("✗ Şevval Erol staff tablosunda bulunamadı!")
else:
    print(f"   ✓ Staff bulundu: {staff[1]} (Sicil: {staff[2]})")
    
    # 3. Atama yap
    print("\n3. Atama yapılıyor...")
    cur.execute("""
        INSERT INTO event_staff_assignments (
            id, "eventId", "staffId", "tableIds", "shiftId", "isActive", "assignmentType", "sortOrder"
        ) VALUES (%s, %s, %s, %s, %s, true, 'table', 0)
        ON CONFLICT (id) DO UPDATE SET 
            "tableIds" = %s,
            "shiftId" = %s,
            "isActive" = true
    """, (ASSIGNMENT_ID, EVENT_ID, STAFF_ID, TABLE_IDS, SHIFT_ID, TABLE_IDS, SHIFT_ID))
    
    conn.commit()
    print(f"   ✓ Atama yapıldı!")
    print(f"   Masalar: {TABLE_IDS}")
    print(f"   Vardiya: 16:00-00:00")

print("\n" + "=" * 60)
print("TAMAMLANDI!")
print("=" * 60)
cur.close()
conn.close()
