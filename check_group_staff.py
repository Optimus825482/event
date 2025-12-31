import psycopg2

conn = psycopg2.connect(
    host='localhost', 
    port=5432, 
    user='postgres', 
    password='518518Erkan', 
    dbname='eventflow'
)
cur = conn.cursor()

event_id = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'

# GRUP-1'in masalarını al
print("GRUP-1 DETAY:")
print("=" * 50)
cur.execute("""
    SELECT id, name, "tableIds" FROM table_groups 
    WHERE "eventId" = %s AND name = 'GRUP-1'
""", (event_id,))
grup1 = cur.fetchone()
if grup1:
    print(f"ID: {grup1[0]}")
    print(f"Name: {grup1[1]}")
    print(f"TableIds: {grup1[2]}")
    
    # Bu masalara atanmış personel var mı?
    # tableIds array overlap kontrolü
    cur.execute("""
        SELECT s."fullName", esa."tableIds"
        FROM event_staff_assignments esa 
        JOIN staff s ON s.id = esa."staffId"
        WHERE esa."eventId" = %s 
        AND esa."tableIds" && %s
    """, (event_id, grup1[2]))
    staff = cur.fetchall()
    print(f"\nBu masalara atanmış personel ({len(staff)} kişi):")
    for s in staff:
        print(f"  - {s[0]}: {s[1]}")

# Tüm personel atamalarını kontrol et
print("\n" + "=" * 50)
print("TÜM PERSONEL ATAMALARI:")
cur.execute("""
    SELECT s."fullName", esa."tableIds"
    FROM event_staff_assignments esa 
    JOIN staff s ON s.id = esa."staffId"
    WHERE esa."eventId" = %s
    ORDER BY s."fullName"
    LIMIT 20
""", (event_id,))
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

cur.close()
conn.close()
