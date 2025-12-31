import psycopg2
conn = psycopg2.connect(host='localhost', port=5432, database='eventflow', user='postgres', password='518518Erkan')
cur = conn.cursor()
cur.execute("SELECT id, \"fullName\" FROM users WHERE role = 'staff' AND UPPER(\"fullName\") LIKE '%FIND%'")
print(cur.fetchall())
cur.close()
conn.close()
