"""
Excel'deki resimlerin hangi hücrelere ait olduğunu analiz eder.
VML Drawing ve Relations dosyalarını parse ederek resim-satır eşleşmesini bulur.
"""

import zipfile
import os
import re
from xml.etree import ElementTree as ET

EXCEL_FILE = "Kitap1.xlsx"

def analyze():
    with zipfile.ZipFile(EXCEL_FILE, 'r') as z:
        # 1. VML Drawing dosyasını oku
        vml_content = z.read('xl/drawings/vmlDrawing1.vml').decode('utf-8')
        
        # 2. Relations dosyasını oku (resim ID -> dosya adı eşleşmesi)
        rels_content = z.read('xl/drawings/_rels/vmlDrawing1.vml.rels').decode('utf-8')
        
        # Relations'dan rId -> image dosyası eşleşmesini çıkar
        rels_root = ET.fromstring(rels_content)
        ns = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
        
        rel_to_image = {}
        for rel in rels_root.findall('.//r:Relationship', ns):
            if rel is None:
                continue
            rid = rel.get('Id')
            target = rel.get('Target')
            if rid and target and 'image' in target.lower():
                # ../media/image1.jpeg -> image1.jpeg
                image_name = os.path.basename(target)
                rel_to_image[rid] = image_name
        
        print(f"Relations'da {len(rel_to_image)} resim bulundu")
        
        # 3. VML'den shape'leri parse et
        # Her shape'in Row bilgisi ve imagedata relid'si var
        
        # Shape pattern - basit regex ile
        shape_pattern = r'<v:shape[^>]*id="([^"]*)"[^>]*>.*?</v:shape>'
        shapes = re.findall(shape_pattern, vml_content, re.DOTALL)
        
        print(f"VML'de {len(shapes)} shape ID bulundu")
        
        # Daha detaylı analiz - her shape bloğunu bul
        shape_blocks = re.split(r'(?=<v:shape)', vml_content)
        
        row_image_map = {}  # row -> image_file
        
        for block in shape_blocks:
            if '<v:shape' not in block:
                continue
            
            # Row bilgisini bul
            row_match = re.search(r'<x:Row>(\d+)</x:Row>', block)
            # RelId bilgisini bul
            relid_match = re.search(r'o:relid="(rId\d+)"', block)
            
            if row_match and relid_match:
                row = int(row_match.group(1))
                relid = relid_match.group(1)
                
                if relid in rel_to_image:
                    image_file = rel_to_image[relid]
                    row_image_map[row] = image_file
        
        print(f"\nSatır-Resim eşleşmesi: {len(row_image_map)} adet")
        
        # İlk 10 eşleşmeyi göster
        print("\nİlk 10 eşleşme:")
        sorted_rows = sorted(row_image_map.keys())
        for row in sorted_rows[:10]:
            print(f"  Satır {row+1} (0-indexed: {row}) -> {row_image_map[row]}")
        
        # CSV'den sicil numaralarını oku
        print("\n" + "="*50)
        print("CSV ile karşılaştırma:")
        
        csv_data = {}
        with open("Kitap1.csv", "r", encoding="utf-8") as f:
            lines = f.readlines()[1:]  # Başlık atla
            for i, line in enumerate(lines):
                if line.strip():
                    parts = line.split(";")
                    if len(parts) >= 2:
                        sicil = parts[0].strip()
                        isim = parts[1].strip()
                        csv_data[i+1] = {"sicil": sicil, "isim": isim}  # 1-indexed (Excel satırı)
        
        print(f"CSV'de {len(csv_data)} kayıt var")
        
        # Eşleşmeleri göster
        print("\nDoğru eşleşme örneği (ilk 5):")
        for row in sorted_rows[:5]:
            excel_row = row + 1  # 0-indexed -> 1-indexed
            if excel_row in csv_data:
                person = csv_data[excel_row]
                image = row_image_map[row]
                print(f"  Excel Satır {excel_row+1}: {person['sicil']} - {person['isim']} -> {image}")
        
        return row_image_map, csv_data

if __name__ == "__main__":
    analyze()
