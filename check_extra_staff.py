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

# Tablo yapısı
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'event_extra_staff' AND table_schema = 'public'
    ORDER BY ordinal_position
""")
print("event_extra_staff tablo yapısı:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} (nullable: {row[2]}, default: {row[3]})")

# Mevcut kayıtlar
cur.execute("SELECT COUNT(*) FROM event_extra_staff")
print(f"\nMevcut kayıt sayısı: {cur.fetchone()[0]}")

cur.close()
conn.close()
