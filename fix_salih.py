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

# Salih'i ara
cur.execute("SELECT id, \"fullName\" FROM staff WHERE \"fullName\" ILIKE '%salih%'")
results = cur.fetchall()
print("Salih araması:")
for r in results:
    print(f"  {r[0]} - {r[1]}")

if results:
    staff_id = str(results[0][0])
    event_id = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'
    
    # Atama ekle
    cur.execute('''
        INSERT INTO event_staff_assignments 
        (id, "eventId", "staffId", "tableIds", "assignmentType", 
         "specialTaskStartTime", "specialTaskEndTime", "sortOrder", "isActive", "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, 'table', %s, %s, %s, true, NOW(), NOW())
    ''', ('b1000001-0001-0001-0001-000000000100', event_id, staff_id, ['101','116','117'], '20:00', '02:00', 100))
    conn.commit()
    print(f"✓ Salih ataması eklendi: {results[0][1]}")

cur.close()
conn.close()
