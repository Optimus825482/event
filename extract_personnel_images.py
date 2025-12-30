"""
Excel dosyasındaki personel resimlerini çıkarma scripti
Açıklamalara (comments) gömülü resimleri personel adıyla kaydeder
"""

import os
import zipfile
import shutil
from xml.etree import ElementTree as ET
import re

# Çıktı klasörü
OUTPUT_DIR = "personnel_images"
EXCEL_FILE = "Kitap1.xlsx"

def clean_filename(name):
    """Dosya adı için geçersiz karakterleri temizle"""
    # Türkçe karakterleri ASCII'ye çevir
    tr_map = {
        'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S',
        'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
    }
    for tr, en in tr_map.items():
        name = name.replace(tr, en)
    
    # Dosya sistemi için geçersiz karakterleri temizle
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        name = name.replace(char, '')
    return name.strip()

def extract_images_from_xlsx():
    """Excel dosyasından resimleri çıkar"""
    
    if not os.path.exists(EXCEL_FILE):
        print(f"HATA: {EXCEL_FILE} bulunamadı!")
        return
    
    # Çıktı klasörünü oluştur
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR)
    
    # Geçici klasör
    temp_dir = "temp_xlsx_extract"
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    
    # XLSX aslında bir ZIP dosyasıdır
    print(f"📂 {EXCEL_FILE} açılıyor...")
    with zipfile.ZipFile(EXCEL_FILE, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
    
    # CSV'den personel bilgilerini oku (satır numarası -> isim eşleştirmesi)
    personnel_list = []
    try:
        with open("Kitap1.csv", "r", encoding="utf-8") as f:
            lines = f.readlines()[1:]  # Başlık satırını atla
            for line in lines:
                if line.strip():
                    parts = line.split(";")
                    if len(parts) >= 2:
                        sicil_no = parts[0].strip()
                        full_name = parts[1].strip()
                        personnel_list.append({
                            "sicilNo": sicil_no,
                            "fullName": full_name
                        })
    except Exception as e:
        print(f"CSV okuma hatası: {e}")
    
    print(f"📋 {len(personnel_list)} personel bilgisi yüklendi")
    
    # Resimleri bul
    media_dir = os.path.join(temp_dir, "xl", "media")
    
    if not os.path.exists(media_dir):
        print("HATA: Media klasörü bulunamadı!")
        shutil.rmtree(temp_dir)
        return
    
    # Resimleri sırala (image1, image2, ... image226)
    images = os.listdir(media_dir)
    
    def get_image_number(filename):
        match = re.search(r'image(\d+)', filename)
        return int(match.group(1)) if match else 0
    
    sorted_images = sorted(images, key=get_image_number)
    
    print(f"\n📸 {len(sorted_images)} resim bulundu")
    
    # Resimleri personel adıyla kaydet
    print(f"\n💾 Resimler kaydediliyor...")
    saved_count = 0
    
    for i, img_file in enumerate(sorted_images):
        if i < len(personnel_list):
            person = personnel_list[i]
            src_path = os.path.join(media_dir, img_file)
            
            # Dosya uzantısını al
            ext = os.path.splitext(img_file)[1]
            # Yeni dosya adı: SicilNo_AdSoyad.ext
            safe_name = clean_filename(person['fullName'])
            new_name = f"{person['sicilNo']}_{safe_name}{ext}"
            dst_path = os.path.join(OUTPUT_DIR, new_name)
            
            try:
                shutil.copy2(src_path, dst_path)
                saved_count += 1
                if saved_count <= 10 or saved_count % 50 == 0:
                    print(f"   ✅ {new_name}")
            except Exception as e:
                print(f"   ❌ {new_name}: {e}")
    
    # Temizlik
    shutil.rmtree(temp_dir)
    
    print(f"\n{'='*50}")
    print(f"✅ Toplam {saved_count} resim kaydedildi: {OUTPUT_DIR}/")
    print(f"{'='*50}")

if __name__ == "__main__":
    extract_images_from_xlsx()
