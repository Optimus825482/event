"""
Local veritabanına eksik personelleri ekle
Erkan için hazırlandı
"""

import psycopg2
from psycopg2.extras import RealDictCursor

# Local DB bağlantı bilgileri
LOCAL_DB = {
    "host": "localhost",
    "port": 5432,
    "database": "eventflow",
    "user": "postgres",
    "password": "518518Erkan"
}

# Eklenecek personeller
NEW_STAFF = [
    ("G-6", "Mahperi Kurt"),
    ("G-7", "Cihan Erdoğan"),
    ("G-8", "Ali Gezer"),
    ("G-9", "Halit Bağış"),
    ("G-10", "Bilal Iqbal"),
    ("G-11", "Eren Önder"),
    ("G-12", "Ramazan Doğanay"),
    ("G-13", "Nur Absal"),
    ("G-14", "Sergen Elmas"),
    ("G-15", "Salman Ali"),
    ("G-16", "Muhammed Abdullah"),
    ("G-17", "Muhammed Wassem"),
    ("G-18", "Hüseyin Tülegen"),
]

def main():
    try:
        conn = psycopg2.connect(**LOCAL_DB)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("=" * 60)
        print("LOCAL DB - YENİ PERSONEL EKLEME")
        print("=" * 60)
        
        added = 0
        skipped = 0
        
        for sicil_no, full_name in NEW_STAFF:
            # Önce var mı kontrol et
            cur.execute(
                'SELECT id FROM staff WHERE "sicilNo" = %s OR "fullName" = %s',
                (sicil_no, full_name)
            )
            existing = cur.fetchone()
            
            if existing:
                print(f"⏭️  {sicil_no} - {full_name} zaten mevcut, atlanıyor...")
                skipped += 1
                continue
            
            # Ekle
            cur.execute("""
                INSERT INTO staff ("sicilNo", "fullName", "position", "department", "isActive", "status")
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, "sicilNo", "fullName"
            """, (sicil_no, full_name, "Waiter / Waitress", "Restaurant", True, "active"))
            
            result = cur.fetchone()
            print(f"✅ Eklendi: {result['sicilNo']} - {result['fullName']}")
            added += 1
        
        conn.commit()
        
        print("=" * 60)
        print(f"SONUÇ: {added} eklendi, {skipped} atlandı")
        print("=" * 60)
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ HATA: {e}")
        raise

if __name__ == "__main__":
    main()
