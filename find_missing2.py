import psycopg2
conn = psycopg2.connect(host='localhost', port=5432, user='postgres', password='518518Erkan', dbname='eventflow')
cur = conn.cursor()

missing = ['Halit', 'Sıla', 'Kaan', 'Kazım', 'Barış', 'Fındıcak', 'Yıldırım', 'Ağırman']
for name in missing:
    cur.execute('SELECT id, "fullName" FROM staff WHERE "fullName" ILIKE %s', (f'%{name}%',))
    results = cur.fetchall()
    print(f'{name}: {results}')

cur.close()
conn.close()
