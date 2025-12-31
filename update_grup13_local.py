import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='eventflow',
    user='postgres',
    password='518518Erkan'
)
cur = conn.cursor()

# GRUP-13'e masa 166 ekle
cur.execute("""
    UPDATE table_groups 
    SET "tableIds" = ARRAY['136', '137', '151', '152', '166']
    WHERE "eventId" = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b' 
    AND name = 'GRUP-13'
    RETURNING name, "tableIds"
""")
result = cur.fetchone()
conn.commit()
print(f'Local DB: {result[0]} -> {result[1]}')
conn.close()
