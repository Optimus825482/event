import psycopg2
import json

EVENT_ID = "4d9fb75e-dbcb-4b26-9823-28ecac3e421b"

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='518518Erkan',
    dbname='eventflow'
)
cur = conn.cursor()

cur.execute('''
    SELECT esa."staffId", esa."tableIds", esa."shiftStart", esa."shiftEnd", esa."sortOrder", s."fullName"
    FROM event_staff_assignments esa
    JOIN staff s ON s.id = esa."staffId"
    WHERE esa."eventId" = %s
    ORDER BY esa."sortOrder"
''', (EVENT_ID,))

assignments = cur.fetchall()

# SQL INSERT statements oluştur
print("-- Coolify için SQL")
print(f"DELETE FROM event_staff_assignments WHERE \"eventId\" = '{EVENT_ID}';")
print()

for staff_id, table_ids, shift_start, shift_end, sort_order, name in assignments:
    tables_str = "ARRAY[" + ",".join([f"'{t}'" for t in table_ids]) + "]"
    print(f"INSERT INTO event_staff_assignments (\"eventId\", \"staffId\", \"tableIds\", \"shiftStart\", \"shiftEnd\", \"sortOrder\", \"isActive\", \"assignmentType\") VALUES ('{EVENT_ID}', '{staff_id}', {tables_str}, '{shift_start}', '{shift_end}', {sort_order}, true, 'table'); -- {name}")

cur.close()
conn.close()
