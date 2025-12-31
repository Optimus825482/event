import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='eventflow',
    user='postgres',
    password='518518Erkan'
)
cur = conn.cursor()

cur.execute("""
INSERT INTO staff (id, "sicilNo", "fullName", email, position, department, "isActive", color, "createdAt", "updatedAt")
VALUES ('1f97dc3a-548e-4588-adee-6bd560d6458e', '137772', 'MEHMET YILMAZ', 'mehmet.yilmaz@eventflow.com', 'Kaptan', 'Servis', true, '#22c55e', NOW(), NOW())
ON CONFLICT (id) DO NOTHING
RETURNING "fullName", position
""")
result = cur.fetchone()
conn.commit()
print(f'Local DB: {result}' if result else 'Zaten mevcut veya eklendi')
conn.close()
