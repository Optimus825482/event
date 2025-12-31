import psycopg2
import os

EVENT_ID = "4d9fb75e-dbcb-4b26-9823-28ecac3e421b"

# Local DB'den atamaları al
local_conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='518518Erkan',
    dbname='eventflow'
)
local_cur = local_conn.cursor()

local_cur.execute('''
    SELECT esa."staffId", esa."tableIds", esa."shiftStart", esa."shiftEnd", esa."sortOrder", s."fullName"
    FROM event_staff_assignments esa
    JOIN staff s ON s.id = esa."staffId"
    WHERE esa."eventId" = %s
    ORDER BY esa."sortOrder"
''', (EVENT_ID,))

assignments = local_cur.fetchall()
print(f"Local'den {len(assignments)} atama alındı")

local_cur.close()
local_conn.close()

# Coolify DB'ye bağlan
coolify_conn = psycopg2.connect(
    host='srv860747.hstgr.cloud',
    port=5432,
    user='postgres',
    password='Eventflow2024!Secure#DB',
    dbname='eventflow'
)
coolify_cur = coolify_conn.cursor()

# Kolonları ekle
try:
    coolify_cur.execute('ALTER TABLE event_staff_assignments ADD COLUMN IF NOT EXISTS "shiftStart" VARCHAR(10)')
    coolify_cur.execute('ALTER TABLE event_staff_assignments ADD COLUMN IF NOT EXISTS "shiftEnd" VARCHAR(10)')
    coolify_conn.commit()
except Exception as e:
    print(f"Kolon ekleme: {e}")
    coolify_conn.rollback()

# Mevcut atamaları sil
coolify_cur.execute('DELETE FROM event_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
print(f"Coolify'dan {coolify_cur.rowcount} atama silindi")

# Yeni atamaları ekle
success = 0
for staff_id, table_ids, shift_start, shift_end, sort_order, name in assignments:
    try:
        coolify_cur.execute('''
            INSERT INTO event_staff_assignments 
            ("eventId", "staffId", "tableIds", "shiftStart", "shiftEnd", "sortOrder", "isActive", "assignmentType")
            VALUES (%s, %s, %s, %s, %s, %s, true, 'table')
        ''', (EVENT_ID, str(staff_id), table_ids, shift_start, shift_end, sort_order))
        success += 1
    except Exception as e:
        print(f"Hata ({name}): {e}")

coolify_conn.commit()
print(f"\nCoolify'a {success} atama eklendi!")

coolify_cur.close()
coolify_conn.close()
