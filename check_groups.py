import psycopg2
conn = psycopg2.connect(host='localhost', port=5432, database='eventflow', user='postgres', password='518518Erkan')
cur = conn.cursor()
cur.execute("""SELECT name FROM table_groups WHERE "eventId" = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b' ORDER BY "sortOrder" LIMIT 10""")
for row in cur.fetchall():
    print(row[0])
cur.close()
conn.close()
