#!/usr/bin/env python3
import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='eventflow',
    user='postgres',
    password='518518Erkan'
)
cur = conn.cursor()

EVENT_ID = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'

# Personel atamalarını sil
cur.execute('DELETE FROM event_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
print(f"✓ Personel atamaları silindi")

# Grupları sil
cur.execute('DELETE FROM table_groups WHERE "eventId" = %s', (EVENT_ID,))
print(f"✓ Gruplar silindi")

conn.commit()
cur.close()
conn.close()
print("✓ İşlem tamamlandı!")
