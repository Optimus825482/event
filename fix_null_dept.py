import psycopg2
conn = psycopg2.connect(host='localhost', port=5432, database='eventflow', user='postgres', password='518518Erkan')
cur = conn.cursor()
cur.execute("UPDATE staff SET department = 'Bar' WHERE \"sicilNo\" = '3303X'")
conn.commit()
print('Local guncellendi')
conn.close()
