import psycopg2

# Local DB connection
conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='eventflow',
    user='postgres',
    password='518518Erkan'
)

cur = conn.cursor()
cur.execute("ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'controller'")
conn.commit()
print('Controller role added to local DB')
conn.close()
