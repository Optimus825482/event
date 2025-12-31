import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='eventflow',
    user='postgres',
    password='518518Erkan'
)
cur = conn.cursor()

# allowedRoles güncelle
cur.execute("""
    UPDATE service_points 
    SET "allowedRoles" = ARRAY['barman', 'captain', 'waiter', 'comis', 'garson', 'runner']
    WHERE "eventId" = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'
""")
conn.commit()
print(f"Updated {cur.rowcount} rows")

# Kontrol
cur.execute("""
    SELECT id, name, "allowedRoles" 
    FROM service_points 
    WHERE "eventId" = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'
""")
for row in cur.fetchall():
    print(row)

cur.close()
conn.close()
