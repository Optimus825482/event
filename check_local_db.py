import psycopg2

conn = psycopg2.connect(
    host='localhost',
    database='eventflow',
    user='postgres',
    password='518518Erkan'
)
cur = conn.cursor()

# Departman bazlı sayım
cur.execute("""
    SELECT department, COUNT(*) as cnt 
    FROM staff 
    WHERE "isActive" = true 
    GROUP BY department 
    ORDER BY cnt DESC
""")
print("LOCAL DATABASE - Departman bazlı:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

# Toplam
cur.execute('SELECT COUNT(*) FROM staff WHERE "isActive" = true')
print(f"\nToplam aktif personel: {cur.fetchone()[0]}")

conn.close()
