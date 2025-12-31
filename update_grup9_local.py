import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="eventflow",
    user="postgres",
    password="518518Erkan"
)

cur = conn.cursor()

# GRUP-9'a 165 ekle
cur.execute("""
    UPDATE table_groups 
    SET "tableIds" = array_append("tableIds", '165')
    WHERE name = 'GRUP-9' 
    AND "eventId" = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'
    AND NOT ('165' = ANY("tableIds"))
""")

# Kontrol et
cur.execute("""
    SELECT name, "tableIds" 
    FROM table_groups 
    WHERE name = 'GRUP-9' 
    AND "eventId" = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'
""")

result = cur.fetchone()
print(f"GRUP-9 masaları: {result[1]}")

conn.commit()
cur.close()
conn.close()
print("✅ Local DB güncellendi")
