#!/usr/bin/env python3
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
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'table_groups' AND table_schema = 'public'
    ORDER BY ordinal_position
""")
print("table_groups tablo yapısı:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} (nullable: {row[2]}, default: {row[3]})")

print("\n\nevent_staff_assignments tablo yapısı:")
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'event_staff_assignments' AND table_schema = 'public'
    ORDER BY ordinal_position
""")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} (nullable: {row[2]}, default: {row[3]})")

cur.close()
conn.close()
