#!/usr/bin/env python3
"""
Personnel Avatar Upload Script
Resimleri backend/uploads/avatars/ klasörüne kopyalar ve
veritabanındaki avatar alanlarını günceller.
"""

import os
import shutil
import psycopg2
from psycopg2.extras import RealDictCursor
import re

# Kaynak ve hedef klasörler
SOURCE_DIR = "personnel_images"
DEST_DIR = "backend/uploads/avatars"

# Veritabanı bağlantısı
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "eventflow",
    "user": "postgres",
    "password": "518518Erkan"
}

def extract_sicil_from_filename(filename):
    """Dosya adından sicil numarasını çıkar"""
    # Format: SicilNo_AdSoyad.jpeg/png
    # Örnek: 100413_Ferdi Kenel.jpeg -> 100413
    match = re.match(r'^(\d+[Xx]*)_', filename)
    if match:
        return match.group(1).upper()  # X'leri büyük harfe çevir
    return None

def main():
    # Hedef klasörü oluştur
    os.makedirs(DEST_DIR, exist_ok=True)
    
    # Veritabanına bağlan
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Tüm personeli al (sicilNo ile)
    cursor.execute('SELECT id, "sicilNo", "fullName" FROM staff')
    personnel = {row['sicilNo'].upper(): row for row in cursor.fetchall()}
    
    print(f"Veritabanında {len(personnel)} personel bulundu")
    print(f"Kaynak klasörde resim sayısı: {len(os.listdir(SOURCE_DIR))}")
    
    matched = 0
    not_matched = []
    updated = 0
    
    # Her resim için
    for filename in os.listdir(SOURCE_DIR):
        if not filename.lower().endswith(('.jpeg', '.jpg', '.png', '.gif', '.webp')):
            continue
            
        sicil = extract_sicil_from_filename(filename)
        if not sicil:
            print(f"⚠️ Sicil çıkarılamadı: {filename}")
            continue
        
        # Veritabanında ara
        person = personnel.get(sicil)
        if not person:
            not_matched.append((sicil, filename))
            continue
        
        matched += 1
        
        # Dosyayı kopyala (sicil numarası ile yeniden adlandır)
        ext = os.path.splitext(filename)[1].lower()
        new_filename = f"personnel_{sicil}{ext}"
        src_path = os.path.join(SOURCE_DIR, filename)
        dest_path = os.path.join(DEST_DIR, new_filename)
        
        shutil.copy2(src_path, dest_path)
        
        # Veritabanını güncelle
        avatar_path = f"/uploads/avatars/{new_filename}"
        cursor.execute(
            'UPDATE staff SET avatar = %s WHERE id = %s',
            (avatar_path, person['id'])
        )
        updated += 1
        
        print(f"✅ {sicil} - {person['fullName']} -> {new_filename}")
    
    conn.commit()
    
    print(f"\n{'='*50}")
    print(f"📊 SONUÇ:")
    print(f"   Eşleşen: {matched}")
    print(f"   Güncellenen: {updated}")
    print(f"   Eşleşmeyen: {len(not_matched)}")
    
    if not_matched:
        print(f"\n⚠️ Eşleşmeyen sicil numaraları:")
        for sicil, filename in not_matched[:20]:  # İlk 20'yi göster
            print(f"   {sicil} ({filename})")
        if len(not_matched) > 20:
            print(f"   ... ve {len(not_matched) - 20} tane daha")
    
    cursor.close()
    conn.close()
    
    print(f"\n✅ İşlem tamamlandı!")

if __name__ == "__main__":
    main()
