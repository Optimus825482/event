#!/usr/bin/env python3
import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='eventflow',
    user='postgres',
    password='518518Erkan'
)
cursor = conn.cursor()

# Tüm tabloları listele
cursor.execute("""
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
""")
tables = cursor.fetchall()
print("Mevcut tablolar:")
for t in tables:
    print(f"  - {t[0]}")

cursor.close()
conn.close()
