"""
Local veritabanına leaders sütununu ekle
"""
import psycopg2

# Local DB bağlantısı
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="eventflow",
    user="postgres",
    password="518518Erkan"
)

cursor = conn.cursor()

# leaders sütununu ekle
cursor.execute("""
    ALTER TABLE service_teams 
    ADD COLUMN IF NOT EXISTS leaders jsonb DEFAULT '[]'::jsonb;
""")

conn.commit()
print("✅ leaders sütunu eklendi!")

# Kontrol et
cursor.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'service_teams' 
    ORDER BY ordinal_position;
""")

print("\n📋 service_teams sütunları:")
for row in cursor.fetchall():
    print(f"  - {row[0]}: {row[1]}")

cursor.close()
conn.close()
