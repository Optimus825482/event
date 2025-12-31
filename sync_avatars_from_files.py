#!/usr/bin/env python3
"""
Personel resimlerini base64'e çevirip Coolify veritabanına yükler.
Dosya isimlerinden sicil numarasını çıkarıp, avatar alanını günceller.
"""

import os
import base64
import psycopg2
from pathlib import Path

# Veritabanı bağlantı bilgileri (Coolify)
DB_CONFIG = {
    'host': '185.9.38.66',
    'port': 5433,
    'database': 'eventflow',
    'user': 'postgres',
    'password': 'EventFlow2024SecurePass!'
}

# Kaynak klasör
SOURCE_DIR = Path(r'D:\event\personnel_images_correct')

def get_sicil_from_filename(filename: str) -> str:
    """Dosya isminden sicil numarasını çıkarır."""
    name_without_ext = filename.rsplit('.', 1)[0]
    sicil = name_without_ext.split('_')[0]
    return sicil

def image_to_base64(filepath: Path) -> str:
    """Resmi base64 data URL'e çevirir."""
    with open(filepath, 'rb') as f:
        data = base64.b64encode(f.read()).decode('utf-8')
    return f"data:image/jpeg;base64,{data}"

def main():
    print("Veritabanına bağlanılıyor...")
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # Tüm personelleri al
    cursor.execute('SELECT id, "sicilNo", "fullName" FROM staff')
    staff_list = cursor.fetchall()
    staff_dict = {row[1].upper(): {'id': row[0], 'name': row[2], 'sicil': row[1]} for row in staff_list}
    
    print(f"Toplam {len(staff_dict)} personel bulundu.")
    print(f"Resim klasörü: {SOURCE_DIR}")
    
    # Resim dosyalarını işle
    updated = 0
    not_found = []
    errors = []
    
    image_files = list(SOURCE_DIR.glob('*.jpeg')) + list(SOURCE_DIR.glob('*.jpg')) + list(SOURCE_DIR.glob('*.png'))
    print(f"Toplam {len(image_files)} resim dosyası bulundu.\n")
    
    for img_file in image_files:
        sicil = get_sicil_from_filename(img_file.name)
        sicil_upper = sicil.upper()
        
        if sicil_upper in staff_dict:
            try:
                staff_info = staff_dict[sicil_upper]
                base64_data = image_to_base64(img_file)
                
                # Veritabanını güncelle
                cursor.execute(
                    'UPDATE staff SET avatar = %s WHERE id = %s',
                    (base64_data, staff_info['id'])
                )
                updated += 1
                print(f"✓ [{updated}] {staff_info['sicil']} - {staff_info['name']}")
            except Exception as e:
                errors.append((sicil, str(e)))
                print(f"✗ {sicil} - HATA: {e}")
        else:
            not_found.append((sicil, img_file.name))
    
    conn.commit()
    
    print(f"\n{'='*60}")
    print(f"✓ Güncellenen: {updated}")
    print(f"✗ Eşleşmeyen: {len(not_found)}")
    print(f"⚠ Hata: {len(errors)}")
    
    if not_found:
        print("\nEşleşmeyen dosyalar (sicil DB'de yok):")
        for sicil, filename in not_found[:15]:
            print(f"  - {sicil}: {filename}")
        if len(not_found) > 15:
            print(f"  ... ve {len(not_found) - 15} dosya daha")
    
    cursor.close()
    conn.close()
    print("\n✓ Tamamlandı!")

if __name__ == '__main__':
    main()
