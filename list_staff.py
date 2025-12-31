import psycopg2
conn = psycopg2.connect(host='localhost', port=5432, user='postgres', password='518518Erkan', dbname='eventflow')
cur = conn.cursor()
cur.execute('SELECT "fullName" FROM staff ORDER BY "fullName"')
for r in cur.fetchall():
    print(r[0])
cur.close()
conn.close()
