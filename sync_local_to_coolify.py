#!/usr/bin/env python3
"""
Local veritabanından Coolify'a staff verilerini senkronize eder.
"""

import psycopg2
from datetime import datetime, date

# Bağlantı bilgileri
LOCAL_DB = {
    'host': 'localhost',
    'port': 5432,
    'database': 'eventflow',
    'user': 'postgres',
    'password': '518518Erkan'
}

COOLIFY_DB = {
    'host': '185.9.38.66',
    'port': 5433,
    'database': 'eventflow',
    'user': 'postgres',
    'password': 'EventFlow2024SecurePass!'
}

def serialize_value(val):
    """Değeri SQL için uygun formata çevir"""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    return val

def main():
    print("Local veritabanına bağlanılıyor...")
    local = psycopg2.connect(**LOCAL_DB)
    local_cur = local.cursor()
    
    print("Coolify veritabanına bağlanılıyor...")
    coolify = psycopg2.connect(**COOLIFY_DB)
    coolify_cur = coolify.cursor()
    
    # 1. Coolify'daki staff tablosunu temizle
    print("\n1. Coolify staff tablosu temizleniyor...")
    coolify_cur.execute("TRUNCATE TABLE staff CASCADE")
    coolify.commit()
    print("   ✓ Staff tablosu temizlendi")
    
    # 2. Local'den staff verilerini çek
    print("\n2. Local'den staff verileri çekiliyor...")
    local_cur.execute("""
        SELECT id, "sicilNo", "fullName", email, phone, avatar, position, 
               department, "workLocation", mentor, color, gender, "birthDate", 
               age, "bloodType", "shoeSize", "sockSize", "hireDate", 
               "terminationDate", "terminationReason", "yearsAtCompany", 
               "isActive", status, "createdAt", "updatedAt"
        FROM staff
    """)
    columns = [desc[0] for desc in local_cur.description]
    staff_rows = local_cur.fetchall()
    print(f"   ✓ {len(staff_rows)} staff kaydı bulundu")
    
    # 3. Coolify'a staff verilerini ekle
    print("\n3. Coolify'a staff verileri ekleniyor...")
    insert_sql = """
        INSERT INTO staff (id, "sicilNo", "fullName", email, phone, avatar, position, 
                          department, "workLocation", mentor, color, gender, "birthDate", 
                          age, "bloodType", "shoeSize", "sockSize", "hireDate", 
                          "terminationDate", "terminationReason", "yearsAtCompany", 
                          "isActive", status, "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    for i, row in enumerate(staff_rows):
        serialized_row = tuple(serialize_value(v) for v in row)
        coolify_cur.execute(insert_sql, serialized_row)
        if (i + 1) % 50 == 0:
            print(f"   ... {i + 1}/{len(staff_rows)} eklendi")
    
    coolify.commit()
    print(f"   ✓ {len(staff_rows)} staff kaydı eklendi")
    
    # 4. Doğrulama
    print("\n4. Doğrulama...")
    coolify_cur.execute("SELECT COUNT(*) FROM staff")
    coolify_count = coolify_cur.fetchone()[0]
    
    coolify_cur.execute("SELECT department, COUNT(*) FROM staff GROUP BY department ORDER BY COUNT(*) DESC")
    dept_counts = coolify_cur.fetchall()
    
    print(f"   Coolify staff sayısı: {coolify_count}")
    print("   Departman dağılımı:")
    for dept, count in dept_counts:
        print(f"     - {dept or 'NULL'}: {count}")
    
    # Bağlantıları kapat
    local_cur.close()
    local.close()
    coolify_cur.close()
    coolify.close()
    
    print("\n✓ Senkronizasyon tamamlandı!")

if __name__ == '__main__':
    main()
