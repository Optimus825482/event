#!/usr/bin/env python3
"""
Sibel Can Casino Yılbaşı Galası - Masa Grupları ve Personel Atamaları
"""

import psycopg2
import uuid
from datetime import datetime

# Veritabanı bağlantısı (Coolify)
DB_CONFIG = {
    'host': 'srv860747.hstgr.cloud',
    'port': 5432,
    'database': 'eventflow',
    'user': 'postgres',
    'password': '518518Erkan'
}

EVENT_ID = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'

# Personel listesi - Excel'den
STAFF_ASSIGNMENTS = [
    {"name": "MAHPERİ KURT", "tables": [1, 2, 3, 11, 12], "shift": "20:00-02:00"},
    {"name": "Tuğçe Kirenli", "tables": [101, 116, 117], "shift": "17:00-00:00"},
    {"name": "SALiH SEVIKA", "tables": [101, 116, 117], "shift": "20:00-02:00"},
    {"name": "RAMAZAN NURYA", "tables": [102, 103, 118, 119], "shift": "20:00-00:00"},
    {"name": "ÖZGÜR ÖZGÜN", "tables": [104, 105, 120, 121], "shift": "16:00-00:00"},
    {"name": "Cihan Erdoğan", "tables": [104, 105, 120, 121], "shift": "17:00-00:00"},
    {"name": "YAŞAR ATAMKOÇYİĞİT", "tables": [106, 107, 122, 123], "shift": "12:00-K"},
    {"name": "Ali Gezer", "tables": [106, 107, 122, 123], "shift": "17:00-00:00"},
    {"name": "FURKAN YILDIRIM", "tables": [108, 109, 124, 125], "shift": "12:00-K"},
    {"name": "Halit Bağış", "tables": [108, 109, 124, 125], "shift": "17:00-00:00"},
    {"name": "ERENCAN TURAN", "tables": [110, 111, 126, 127], "shift": "20:00-00:00"},
    {"name": "Bilal Iqbal", "tables": [110, 111, 126, 127], "shift": "17:00-00:00"},
    {"name": "Orhan Atlı", "tables": [112, 113, 128, 129], "shift": "17:00-00:00"},
    {"name": "EREN ÖNDER", "tables": [114, 115, 130, 131], "shift": "20:00-02:00"},
    {"name": "Ramazan Doğanay", "tables": [114, 115, 130, 131], "shift": "17:00-00:00"},
    {"name": "Nur Absal", "tables": [132, 133, 147, 148], "shift": "17:00-00:00"},
    {"name": "SEFA FARUK", "tables": [132, 33, 147, 148], "shift": "12:00-K"},
    {"name": "MUSTAFA BAŞKALE", "tables": [134, 135, 149, 150], "shift": "20:00-02:00"},
    {"name": "Sergen Elmas", "tables": [134, 135, 149, 150], "shift": "17:00-00:00"},
    {"name": "UGUR CAN DELİBAŞ", "tables": [136, 137, 151, 152], "shift": "20:00-00:00"},
    {"name": "Salman Ali", "tables": [136, 137, 151, 152], "shift": "17:00-00:00"},
    {"name": "EMİRHAN BOYRAZ", "tables": [138, 139, 140, 141], "shift": "16:00-00:00"},
    {"name": "Muhammed Abdullah", "tables": [138, 139, 140, 141], "shift": "17:00-00:00"},
    {"name": "BÜNYAMİN AYDIN", "tables": [142, 143, 153, 154], "shift": "16:00-K"},
    {"name": "Muhammed Wassem", "tables": [142, 143, 153, 154], "shift": "17:00-00:00"},
    {"name": "SİBEL ATASOY", "tables": [144, 145, 146, 155, 156, 157], "shift": "16:00-K"},
    {"name": "ONURCAN KOYUN", "tables": [144, 145, 146, 155, 156, 157], "shift": "16:00-K"},
    {"name": "Hüseyin Tülegen", "tables": [144, 145, 146, 155, 156, 157], "shift": "17:00-00:00"},
    {"name": "FERYAL YAMAN", "tables": [159, 45, 46, 160, 59, 60], "shift": "20:00-00:00"},
    {"name": "ZEYNEP OKUR", "tables": [21, 22, 23, 158, 31, 32], "shift": "19:00-00:00"},
    {"name": "OĞUZHAN ELMAS", "tables": [24, 25, 33, 34, 35], "shift": "16:00-K"},
    {"name": "İNANÇ KOÇAK", "tables": [26, 27, 40, 41], "shift": "16:00-K"},
    {"name": "TUGBA ILBAY", "tables": [28, 29, 42, 43], "shift": "19:00-00:00"},
    {"name": "SILA KUVAT", "tables": [30, 162, 44, 163], "shift": "19:00-00:00"},
    {"name": "AZİZ DEMHAT", "tables": [36, 37, 50, 51], "shift": "12:00-K"},
    {"name": "CANER OZKAN KUTLU", "tables": [36, 37, 50, 51], "shift": "16:00-K"},
    {"name": "YUSUF ŞAHİN", "tables": [38, 39, 52, 53], "shift": "16:00-K"},
    {"name": "MEHMET KOÇAK", "tables": [38, 39, 52, 53], "shift": "16:00-K"},
    {"name": "FERAY YAKICI", "tables": [4, 5, 13, 14, 15], "shift": "16:00-00:00"},
    {"name": "EZGİ KAŞIKÇI", "tables": [4, 5, 13, 14, 15], "shift": "16:00-K"},
    {"name": "M.ALİ KARASU", "tables": [47, 48, 61, 62], "shift": "19:00-K"},
    {"name": "HAKAN CİNTOSUN", "tables": [49, 63, 64], "shift": "20:00-00:00"},
    {"name": "KAAN TONYALIOĞLU", "tables": [54, 65, 66], "shift": "20:00-00:00"},
    {"name": "KAZIM KOCA", "tables": [55, 56, 67, 68], "shift": "19:00-00:00"},
    {"name": "ONUR NAMA", "tables": [57, 58, 69, 70, 164], "shift": "20:00-00:00"},
    {"name": "ŞEVVAL EROL", "tables": [6, 7, 8, 16, 17, 18], "shift": "16:00-00:00"},
    {"name": "M. AKİF ŞİMŞEK", "tables": [63, 64, 65, 66], "shift": "16:00-K"},
    {"name": "KEREM ERTÜRK", "tables": [71, 72, 86, 87], "shift": "19:00-K"},
    {"name": "AYTEKİN SARITOPRAK", "tables": [73, 74, 88, 89], "shift": "19:00-K"},
    {"name": "BARIŞ TÜZÜN", "tables": [75, 76, 90, 91], "shift": "16:00-00:00"},
    {"name": "AHMET CAN FINDICAK", "tables": [77, 78, 92, 93], "shift": "16:00-00:00"},
    {"name": "ÖMER İNCE", "tables": [77, 78, 92, 93], "shift": "16:00-K"},
    {"name": "Ahmet Deste", "tables": [77, 78, 92, 93], "shift": "17:00-00:00"},
    {"name": "ALİ DÖNMEZ", "tables": [79, 80, 94, 95], "shift": "16:00-K"},
    {"name": "CAFER MELİH YEL", "tables": [81, 82, 96, 97], "shift": "20:00-00:00"},
    {"name": "MEHMET YILDIRIM", "tables": [83, 84, 85, 98, 99, 100], "shift": "19:00-K"},
    {"name": "YILDIZ AĞIRMAN", "tables": [9, 10, 19, 20, 161], "shift": "20:00-00:00"},
]

# İsim eşleştirme haritası (Excel -> DB)
NAME_MAPPING = {
    "RAMAZAN NURYA": "Ramazan Nuryagdyyev",
    "Ahmet Deste": "Mehmet Ali Deste",
    "ZEYNEP OKUR": "Zeynep Ebru Okur",
    "EZGİ KAŞIKÇI": "Ezgi Çağla Kaşıkçı",
    "AZİZ DEMHAT": "Aziz Demhat Yılmaz",
    "SEFA FARUK": "Sefa Faruk Kurt",
    "M.ALİ KARASU": "Mehmet Ali Karasu",
    "M. AKİF ŞİMŞEK": "Mehmet Akif Şimşek",
}

def normalize_name(name):
    """İsmi normalize et"""
    return ' '.join(name.upper().split())

def find_staff_id(cursor, name):
    """Personel ID'sini bul"""
    # Önce mapping'e bak
    mapped_name = NAME_MAPPING.get(name.strip(), name.strip())
    
    # Tam eşleşme dene
    cursor.execute('''
        SELECT id, "fullName" FROM staff 
        WHERE UPPER("fullName") = UPPER(%s) AND "isActive" = true
    ''', (mapped_name,))
    result = cursor.fetchone()
    if result:
        return result[0], result[1]
    
    # Fuzzy eşleşme dene
    normalized = normalize_name(mapped_name)
    cursor.execute('''
        SELECT id, "fullName" FROM staff 
        WHERE "isActive" = true
    ''')
    all_staff = cursor.fetchall()
    
    for staff_id, full_name in all_staff:
        db_normalized = normalize_name(full_name)
        # İsim parçalarını karşılaştır
        input_parts = set(normalized.split())
        db_parts = set(db_normalized.split())
        
        # En az 2 parça eşleşiyorsa kabul et
        common = input_parts & db_parts
        if len(common) >= 2:
            return staff_id, full_name
        
        # Tek kelime ama tam eşleşme
        if len(input_parts) == 1 and input_parts.issubset(db_parts):
            return staff_id, full_name
    
    return None, None

def parse_shift(shift_str):
    """Vardiya saatlerini parse et"""
    if '-K' in shift_str:
        start = shift_str.replace('-K', ':00')
        return start, None  # Kapanışa kadar
    
    parts = shift_str.replace('--', '-').split('-')
    if len(parts) == 2:
        start = parts[0].strip()
        end = parts[1].strip()
        if ':' not in start:
            start += ':00'
        if ':' not in end:
            end += ':00'
        return start, end
    
    return shift_str, None

def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    print("=" * 60)
    print("SİBEL CAN CASINO YILBAŞI GALASI - Personel Atamaları")
    print("=" * 60)
    
    # Mevcut atamaları temizle (Şevval Erol hariç)
    cursor.execute('''
        DELETE FROM event_staff_assignments 
        WHERE "eventId" = %s 
        AND "staffId" != '758d1a92-c558-4bca-afbf-42c6c1a7d865'
    ''', (EVENT_ID,))
    print(f"✓ Mevcut atamalar temizlendi")
    
    # Personel eşleştirme ve atama
    matched = []
    not_found = []
    
    for assignment in STAFF_ASSIGNMENTS:
        name = assignment["name"]
        tables = assignment["tables"]
        shift = assignment["shift"]
        
        staff_id, db_name = find_staff_id(cursor, name)
        
        if staff_id:
            start_time, end_time = parse_shift(shift)
            matched.append({
                "staff_id": staff_id,
                "db_name": db_name,
                "excel_name": name,
                "tables": tables,
                "shift_start": start_time,
                "shift_end": end_time
            })
        else:
            not_found.append(name)
    
    print(f"\n✓ Eşleşen personel: {len(matched)}")
    print(f"✗ Bulunamayan personel: {len(not_found)}")
    
    if not_found:
        print("\nBulunamayan personeller:")
        for name in not_found:
            print(f"  - {name}")
    
    # Atamaları veritabanına ekle
    print("\n" + "-" * 60)
    print("Atamalar ekleniyor...")
    
    for idx, m in enumerate(matched):
        # Şevval Erol zaten ekli, atla
        if str(m["staff_id"]) == "758d1a92-c558-4bca-afbf-42c6c1a7d865":
            print(f"  ⏭ {m['db_name']} - zaten atanmış")
            continue
        
        assignment_id = str(uuid.uuid4())
        table_ids = [str(t) for t in m["tables"]]
        
        cursor.execute('''
            INSERT INTO event_staff_assignments 
            (id, "eventId", "staffId", "tableIds", "assignmentType", 
             "specialTaskStartTime", "specialTaskEndTime", "sortOrder", "isActive")
            VALUES (%s, %s, %s, %s, 'table', %s, %s, %s, true)
        ''', (
            assignment_id,
            EVENT_ID,
            str(m["staff_id"]),
            table_ids,
            m["shift_start"],
            m["shift_end"],
            idx
        ))
        print(f"  ✓ {m['db_name']} -> Masalar: {m['tables']}")
    
    conn.commit()
    
    # Sonuç özeti
    print("\n" + "=" * 60)
    print("ÖZET")
    print("=" * 60)
    
    cursor.execute('''
        SELECT COUNT(*) FROM event_staff_assignments 
        WHERE "eventId" = %s
    ''', (EVENT_ID,))
    total = cursor.fetchone()[0]
    print(f"Toplam atama sayısı: {total}")
    
    cursor.close()
    conn.close()
    print("\n✓ İşlem tamamlandı!")

if __name__ == "__main__":
    main()
