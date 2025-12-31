import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="eventflow",
    user="postgres",
    password="518518Erkan"
)
cur = conn.cursor()

cur.execute('SELECT id, "fullName" FROM users WHERE role = %s ORDER BY "fullName"', ('staff',))
rows = cur.fetchall()

print(f"Toplam {len(rows)} staff")
for r in rows:
    print(f"{r[0]} | {r[1]}")

cur.close()
conn.close()
