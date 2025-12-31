import psycopg2

EVENT_ID = "4d9fb75e-dbcb-4b26-9823-28ecac3e421b"

# Eksik 8 personel - direkt ID ile
MISSING_STAFF = [
    ("682486be-71e2-4064-8981-b3ce41a64139", "Halit Bağış", ["108", "109", "124", "125"], "17:00", "00:00"),
    ("a77cba8d-bf7e-42d0-aa7d-b16e5fe8fe60", "Sıla Kuvat", ["30", "162", "44", "163"], "19:00", "00:00"),
    ("79254b21-7551-49e6-8185-f23a293b77c6", "Kaan Tonyalıoğlu", ["54", "65", "66"], "20:00", "00:00"),
    ("36e98531-bc5d-4112-b955-bd650e97f099", "Kazım Koca", ["55", "56", "67", "68"], "19:00", "00:00"),
    ("565d9af8-2d04-43e4-a8bf-819b34719f8b", "Barış Tüzün", ["75", "76", "90", "91"], "16:00", "00:00"),
    ("fd1e00be-03d6-4184-9fb8-5dad0202782f", "Ahmet Can Fındıcak", ["77", "78", "92", "93"], "16:00", "00:00"),
    ("599947df-060d-4f78-b6dd-f6d7e49d3121", "Mehmet Yıldırım", ["83", "84", "85", "98", "99", "100"], "19:00", "06:00"),
    ("bda131eb-8b92-4f08-84c6-239ba1b87932", "Yıldız Ağırman", ["9", "10", "19", "20", "161"], "20:00", "00:00"),
]

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='518518Erkan',
    dbname='eventflow'
)
cur = conn.cursor()

# Mevcut max sortOrder'ı al
cur.execute('SELECT MAX("sortOrder") FROM event_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
max_order = cur.fetchone()[0] or 0

for i, (staff_id, name, tables, shift_start, shift_end) in enumerate(MISSING_STAFF, 1):
    cur.execute('''
        INSERT INTO event_staff_assignments 
        ("eventId", "staffId", "tableIds", "shiftStart", "shiftEnd", "sortOrder", "isActive", "assignmentType")
        VALUES (%s, %s, %s, %s, %s, %s, true, 'table')
    ''', (EVENT_ID, staff_id, tables, shift_start, shift_end, max_order + i))
    print(f"✓ {name} eklendi | Masalar: {tables} | Vardiya: {shift_start}-{shift_end}")

conn.commit()
print(f"\n{len(MISSING_STAFF)} eksik personel eklendi!")

# Toplam kontrol
cur.execute('SELECT COUNT(*) FROM event_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
total = cur.fetchone()[0]
print(f"Toplam personel ataması: {total}")

cur.close()
conn.close()
