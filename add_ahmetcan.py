import psycopg2
import uuid

conn = psycopg2.connect(host='localhost', port=5432, database='eventflow', user='postgres', password='518518Erkan')
cur = conn.cursor()

# Ahmetcan Fındıcak'ı bul
cur.execute('SELECT id, "fullName" FROM users WHERE role = %s AND "fullName" LIKE %s', ('staff', '%Ahmetcan%'))
r = cur.fetchone()
print(f"Bulunan: {r}")

if r:
    # Atama ekle - 77,78,92,93 masaları, 16:00-00:00 vardiyası
    cur.execute('''
        INSERT INTO event_staff_assignments (id, "eventId", "staffId", "tableIds", "shiftId", "isActive", "assignmentType", "sortOrder")
        VALUES (%s, %s, %s, %s, %s, true, 'table', 0)
    ''', (str(uuid.uuid4()), '4d9fb75e-dbcb-4b26-9823-28ecac3e421b', str(r[0]), ['77','78','92','93'], 'a1000001-0000-0000-0000-000000000002'))
    conn.commit()
    print(f"✓ {r[1]} eklendi!")
else:
    print("Bulunamadı")

cur.close()
conn.close()
