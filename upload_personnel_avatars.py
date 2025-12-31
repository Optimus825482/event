#!/usr/bin/env python3
"""
Personel resimlerini Coolify backend'e yükleyen script.
Dosya isimlerinden sicil numarasını çıkarıp, veritabanındaki avatar alanını günceller.

Kullanım:
1. Resimleri backend/public/avatars klasörüne kopyala
2. Bu scripti çalıştır: python upload_personnel_avatars.py
"""

import os
import psycopg2
from pathlib import Path
import shutil

# Veritabanı bağlantı bilgileri (Coolify)
DB_CONFIG = {
    'host': '185.9.38.66',
    'port': 5433,
    'database': 'eventflow',
    'user': 'postgres',
    'password': 'eventflow2024secure'
}

# Kaynak ve hedef klasörler
SOURCE_DIR = Path(r'D:\event\personnel_images_correct')
# Backend public klasörü (Coolify'da)
AVATAR_URL_PREFIX = '/avatars/'  # Backend'de static serve edilecek

def get_sicil_from_filename(filename: str) -> str:
    """Dosya isminden sicil numarasını çıkarır.
    Örnek: '3873X_Agilash Rhysbaeva.jpeg' -> '3873X'
    """
    name_without_ext = filename.rsplit('.', 1)[0]
    sicil = name_without_ext.split('_')[0]
    return sicil

def main():
    # Veritabanına bağlan
    print("Veritabanına bağlanılıyor...")
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # Tüm personelleri al
    cursor.execute('SELECT id, "sicilNo", "fullName" FROM staff')
    staff_list = cursor.fetchall()
    staff_dict = {row[1]: {'id': row[0], 'name': row[2]} for row in staff_list}
    
    print(f"Toplam {len(staff_dict)} personel bulundu.")
    
    # Resim dosyalarını işle
    updated = 0
    not_found = []
    
    for img_file in SOURCE_DIR.glob('*.jpeg'):
        sicil = get_sicil_from_filename(img_file.name)
        
        # Sicil numarasını normalize et (büyük/küçük harf)
        sicil_upper = sicil.upper()
        sicil_lower = sicil.lower()
        
        # Veritabanında ara
        matching_sicil = None
        for db_sicil in staff_dict.keys():
            if db_sicil.upper() == sicil_upper:
                matching_sicil = db_sicil
                break
        
        if matching_sicil:
            staff_info = staff_dict[matching_sicil]
            avatar_url = f"{AVATAR_URL_PREFIX}{img_file.name}"
            
            # Veritabanını güncelle
            cursor.execute(
                'UPDATE staff SET avatar = %s WHERE "sicilNo" = %s',
                (avatar_url, matching_sicil)
            )
            updated += 1
            print(f"✓ {matching_sicil} - {staff_info['name']} -> {avatar_url}")
        else:
            not_found.append((sicil, img_file.name))
    
    conn.commit()
    
    print(f"\n{'='*50}")
    print(f"Toplam güncellenen: {updated}")
    print(f"Eşleşmeyen: {len(not_found)}")
    
    if not_found:
        print("\nEşleşmeyen dosyalar:")
        for sicil, filename in not_found[:10]:
            print(f"  - {sicil}: {filename}")
        if len(not_found) > 10:
            print(f"  ... ve {len(not_found) - 10} dosya daha")
    
    cursor.close()
    conn.close()
    print("\nTamamlandı!")

if __name__ == '__main__':
    main()
