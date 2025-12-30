"""
Mevcut personnel_images klasöründeki resimleri backend/uploads/avatars'a kopyalar
ve veritabanındaki avatar alanlarını günceller.

Dosya adı formatı: {sicilNo}_{isim}.{ext}
"""

import os
import shutil
import psycopg2
from PIL import Image

# Konfigürasyon
SOURCE_DIR = "personnel_images"
DEST_DIR = "backend/uploads/avatars"
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "eventflow",
    "user": "postgres",
    "password": "518518Erkan"
}

def get_sicil_from_filename(filename):
    """Dosya adından sicil numarasını çıkar"""
    # Format: {sicilNo}_{isim}.{ext}
    base = os.path.splitext(filename)[0]
    parts = base.split("_")
    if parts:
        return parts[0]
    return None

def optimize_image(src_path, dest_path):
    """Resmi optimize et ve kaydet"""
    try:
        img = Image.open(src_path)
        
        # RGBA/P modunu RGB'ye çevir
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Boyutu küçült (max 300x300)
        max_size = (300, 300)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # JPEG olarak kaydet
        img.save(dest_path, "JPEG", quality=85, optimize=True)
        return True
    except Exception as e:
        print(f"  ✗ Resim optimize edilemedi: {e}")
        # Optimize edilemezse direkt kopyala
        shutil.copy2(src_path, dest_path)
        return True

def main():
    print("=" * 60)
    print("AVATAR SENKRONIZASYONU")
    print("=" * 60)
    
    # Hedef klasörü hazırla
    os.makedirs(DEST_DIR, exist_ok=True)
    
    # Kaynak dosyaları listele
    if not os.path.exists(SOURCE_DIR):
        print(f"✗ Kaynak klasör bulunamadı: {SOURCE_DIR}")
        return
    
    files = [f for f in os.listdir(SOURCE_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp'))]
    print(f"Kaynak klasörde {len(files)} resim bulundu")
    
    # Veritabanı bağlantısı
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Veritabanındaki tüm sicil numaralarını al
    cur.execute('SELECT "sicilNo" FROM staff')
    db_sicils = set(row[0] for row in cur.fetchall())
    print(f"Veritabanında {len(db_sicils)} personel kaydı var")
    
    # Resimleri işle
    copied = 0
    updated = 0
    not_found = []
    
    for filename in files:
        sicil = get_sicil_from_filename(filename)
        if not sicil:
            continue
        
        # Veritabanında var mı?
        if sicil not in db_sicils:
            not_found.append(sicil)
            continue
        
        # Kaynak ve hedef yolları
        src_path = os.path.join(SOURCE_DIR, filename)
        ext = os.path.splitext(filename)[1].lower()
        dest_filename = f"personnel_{sicil}.jpeg"  # Her zaman JPEG olarak kaydet
        dest_path = os.path.join(DEST_DIR, dest_filename)
        
        # Resmi optimize et ve kopyala
        if optimize_image(src_path, dest_path):
            copied += 1
            
            # Veritabanını güncelle
            avatar_path = f"/uploads/avatars/{dest_filename}"
            cur.execute(
                'UPDATE staff SET avatar = %s WHERE "sicilNo" = %s',
                (avatar_path, sicil)
            )
            if cur.rowcount > 0:
                updated += 1
            
            if copied % 50 == 0:
                print(f"  İşlenen: {copied}/{len(files)}")
    
    conn.commit()
    cur.close()
    conn.close()
    
    print("\n" + "=" * 60)
    print("TAMAMLANDI!")
    print(f"  - Kopyalanan resim: {copied}")
    print(f"  - Güncellenen kayıt: {updated}")
    if not_found:
        print(f"  - DB'de bulunamayan: {len(not_found)}")
    print("=" * 60)

if __name__ == "__main__":
    main()
