import psycopg2

EVENT_ID = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'

# Local DB
local = psycopg2.connect(host='localhost', port=5432, database='eventflow', user='postgres', password='518518Erkan')
cur = local.cursor()
cur.execute('SELECT COUNT(*) FROM table_groups WHERE "eventId" = %s', (EVENT_ID,))
local_groups = cur.fetchone()[0]
cur.execute('SELECT COUNT(*) FROM work_shifts WHERE "eventId" = %s', (EVENT_ID,))
local_shifts = cur.fetchone()[0]
cur.execute('SELECT COUNT(*) FROM event_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
local_assignments = cur.fetchone()[0]
cur.close()
local.close()

print("=" * 50)
print("SİBEL CAN ETKİNLİĞİ - DB KARŞILAŞTIRMA")
print("=" * 50)
print(f"{'':20} {'LOCAL':>12} {'COOLIFY':>12}")
print("-" * 50)
print(f"{'Masa Grupları':20} {local_groups:>12} {39:>12}")
print(f"{'Vardiyalar':20} {local_shifts:>12} {8:>12}")
print(f"{'Personel Atamaları':20} {local_assignments:>12} {14:>12}")
print("=" * 50)
if local_assignments > 14:
    print(f"Local'de {local_assignments - 14} fazla atama var")
elif local_assignments < 14:
    print(f"Coolify'da {14 - local_assignments} fazla atama var")
else:
    print("Atamalar eşit!")
