import psycopg2
from datetime import datetime
import uuid

EVENT_ID = "4d9fb75e-dbcb-4b26-9823-28ecac3e421b"

# Personel verileri: (ad_soyad, masa_numaralari, vardiya_baslangic, vardiya_bitis)
# K = 06:00
staff_data = [
    ("MAHPERİ KURT", ["1", "2", "3", "11", "12"], "20:00", "02:00"),
    ("TUĞÇE KİRENLİ", ["101", "116", "117"], "17:00", "00:00"),
    ("SALİH SEVİKA", ["101", "116", "117"], "20:00", "02:00"),
    ("RAMAZAN NURYA", ["102", "103", "118", "119"], "20:00", "00:00"),
    ("ÖZGÜR ÖZGÜN", ["104", "105", "120", "121"], "16:00", "00:00"),
    ("CİHAN ERDOĞAN", ["104", "105", "120", "121"], "17:00", "00:00"),
    ("YAŞAR ATAMKOÇYİĞİT", ["106", "107", "122", "123"], "12:00", "06:00"),
    ("ALİ GEZER", ["106", "107", "122", "123"], "17:00", "00:00"),
    ("FURKAN YILDIRIM", ["108", "109", "124", "125"], "12:00", "06:00"),
    ("HALİT BAĞIŞ", ["108", "109", "124", "125"], "17:00", "00:00"),
    ("ERENCAN TURAN", ["110", "111", "126", "127"], "20:00", "00:00"),
    ("BİLAL IQBAL", ["110", "111", "126", "127"], "17:00", "00:00"),
    ("ORHAN ATLI", ["112", "113", "128", "129"], "17:00", "00:00"),
    ("EREN ÖNDER", ["114", "115", "130", "131"], "20:00", "02:00"),
    ("RAMAZAN DOĞANAY", ["114", "115", "130", "131"], "17:00", "00:00"),
    ("NUR ABSAL", ["132", "133", "147", "148"], "17:00", "00:00"),
    ("SEFA FARUK", ["132", "33", "147", "148"], "12:00", "06:00"),
    ("MUSTAFA BAŞKALE", ["134", "135", "149", "150"], "20:00", "02:00"),
    ("SERGEN ELMAS", ["134", "135", "149", "150"], "17:00", "00:00"),
    ("UĞUR CAN DELİBAŞ", ["136", "137", "151", "152"], "20:00", "00:00"),
    ("SALMAN ALİ", ["136", "137", "151", "152"], "17:00", "00:00"),
    ("EMİRHAN BOYRAZ", ["138", "139", "140", "141"], "16:00", "00:00"),
    ("MUHAMMED ABDULLAH", ["138", "139", "140", "141"], "17:00", "00:00"),
    ("BÜNYAMİN AYDIN", ["142", "143", "153", "154"], "16:00", "06:00"),
    ("MUHAMMED WASSEM", ["142", "143", "153", "154"], "17:00", "00:00"),
    ("SİBEL ATASOY", ["144", "145", "146", "155", "156", "157"], "16:00", "06:00"),
    ("ONURCAN KOYUN", ["144", "145", "146", "155", "156", "157"], "16:00", "06:00"),
    ("HÜSEYİN TÜLEGEN", ["144", "145", "146", "155", "156", "157"], "17:00", "00:00"),
    ("FERYAL YAMAN", ["159", "45", "46", "160", "59", "60"], "20:00", "00:00"),
    ("ZEYNEP OKUR", ["21", "22", "23", "158", "31", "32"], "19:00", "00:00"),
    ("OĞUZHAN ELMAS", ["24", "25", "33", "34", "35"], "16:00", "06:00"),
    ("İNANÇ KOÇAK", ["26", "27", "40", "41"], "16:00", "06:00"),
    ("TUĞBA İLBAY", ["28", "29", "42", "43"], "19:00", "00:00"),
    ("SILA KUVAT", ["30", "162", "44", "163"], "19:00", "00:00"),
    ("AZİZ DEMHAT", ["36", "37", "50", "51"], "12:00", "06:00"),
    ("CANER ÖZKAN KUTLU", ["36", "37", "50", "51"], "16:00", "06:00"),
    ("YUSUF ŞAHİN", ["38", "39", "52", "53"], "16:00", "06:00"),
    ("MEHMET KOÇAK", ["38", "39", "52", "53"], "16:00", "06:00"),
    ("FERAY YAKICI", ["4", "5", "13", "14", "15"], "16:00", "00:00"),
    ("EZGİ KAŞIKÇI", ["4", "5", "13", "14", "15"], "16:00", "06:00"),
    ("M.ALİ KARASU", ["47", "48", "61", "62"], "19:00", "06:00"),
    ("HAKAN CİNTOSUN", ["49", "63", "64"], "20:00", "00:00"),
    ("KAAN TONYALIOĞLU", ["54", "65", "66"], "20:00", "00:00"),
    ("KAZIM KOCA", ["55", "56", "67", "68"], "19:00", "00:00"),
    ("ONUR NAMA", ["57", "58", "69", "70", "164"], "20:00", "00:00"),
    ("ŞEVVAL EROL", ["6", "7", "8", "16", "17", "18"], "16:00", "00:00"),
    ("M. AKİF ŞİMŞEK", ["63", "64", "65", "66"], "16:00", "06:00"),
    ("KEREM ERTÜRK", ["71", "72", "86", "87"], "19:00", "06:00"),
    ("AYTEKİN SARITOPRAK", ["73", "74", "88", "89"], "19:00", "06:00"),
    ("BARIŞ TÜZÜN", ["75", "76", "90", "91"], "16:00", "00:00"),
    ("AHMET CAN FINDICAK", ["77", "78", "92", "93"], "16:00", "00:00"),
    ("ÖMER İNCE", ["77", "78", "92", "93"], "16:00", "06:00"),
    ("AHMET DESTE", ["77", "78", "92", "93"], "17:00", "00:00"),
    ("ALİ DÖNMEZ", ["79", "80", "94", "95"], "16:00", "06:00"),
    ("CAFER MELİH YEL", ["81", "82", "96", "97"], "20:00", "00:00"),
    ("MEHMET YILDIRIM", ["83", "84", "85", "98", "99", "100"], "19:00", "06:00"),
    ("YILDIZ AĞIRMAN", ["9", "10", "19", "20", "161"], "20:00", "00:00"),
]

# Masa numaralarına göre grupları oluştur
# Her benzersiz masa seti bir grup olacak
def get_unique_table_sets():
    """Benzersiz masa setlerini bul ve grupla"""
    table_sets = {}
    for name, tables, start, end in staff_data:
        key = tuple(sorted(tables))
        if key not in table_sets:
            table_sets[key] = {
                'tables': tables,
                'staff': []
            }
        table_sets[key]['staff'].append({
            'name': name,
            'shift_start': start,
            'shift_end': end
        })
    return table_sets

# Renk paleti
COLORS = [
    "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6",
    "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
    "#f43f5e", "#fb7185", "#f472b6", "#e879f9", "#c084fc", "#a78bfa", "#818cf8", "#6366f1",
    "#4f46e5", "#4338ca", "#3730a3", "#312e81", "#1e1b4b", "#0f172a", "#0c4a6e", "#075985",
    "#0369a1", "#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd", "#e0f2fe", "#f0f9ff"
]

def main():
    # Local DB bağlantısı
    local_conn = psycopg2.connect(
        host='localhost',
        port=5432,
        database='eventflow',
        user='postgres',
        password='518518Erkan'
    )
    local_cur = local_conn.cursor()
    
    print("=" * 60)
    print("SİBEL CAN ETKİNLİĞİ - GRUP VE PERSONEL ATAMALARI (LOCAL)")
    print("=" * 60)
    
    # 1. Mevcut grupları ve atamaları sil
    local_cur.execute('DELETE FROM event_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
    local_cur.execute('DELETE FROM table_groups WHERE "eventId" = %s', (EVENT_ID,))
    print(f"✅ Local: Mevcut gruplar ve atamalar silindi")
    
    local_conn.commit()
    
    # 2. Staff tablosundan personelleri al
    local_cur.execute('SELECT id, "fullName" FROM staff WHERE "isActive" = true')
    staff_db = {row[1].upper().strip(): row[0] for row in local_cur.fetchall()}
    print(f"\n📋 Veritabanında {len(staff_db)} aktif personel bulundu")
    
    # 3. Benzersiz masa setlerini bul
    table_sets = get_unique_table_sets()
    print(f"📦 {len(table_sets)} benzersiz grup oluşturulacak")
    
    # 4. Grupları ve atamaları oluştur
    now = datetime.now()
    group_num = 1
    total_assignments = 0
    not_found_staff = []
    
    for table_key, group_data in table_sets.items():
        tables = group_data['tables']
        staff_list = group_data['staff']
        
        # Grup ID ve adı
        group_id = str(uuid.uuid4())
        group_name = f"GRUP-{group_num}"
        group_color = COLORS[(group_num - 1) % len(COLORS)]
        
        # Grubu ekle
        local_cur.execute("""
            INSERT INTO table_groups (id, "eventId", name, color, "tableIds", "groupType", "sortOrder", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, 'standard', %s, %s, %s)
        """, (group_id, EVENT_ID, group_name, group_color, tables, group_num, now, now))
        
        # Personel atamalarını ekle
        for staff_info in staff_list:
            staff_name = staff_info['name'].upper().strip()
            
            # Personeli bul
            staff_id = None
            for db_name, db_id in staff_db.items():
                # Tam eşleşme veya benzer isim
                if staff_name == db_name or staff_name in db_name or db_name in staff_name:
                    staff_id = db_id
                    break
            
            if not staff_id:
                # İsim parçalarıyla ara
                name_parts = staff_name.split()
                for db_name, db_id in staff_db.items():
                    if all(part in db_name for part in name_parts):
                        staff_id = db_id
                        break
            
            if staff_id:
                assignment_id = str(uuid.uuid4())
                local_cur.execute("""
                    INSERT INTO event_staff_assignments 
                    (id, "eventId", "staffId", "tableIds", "specialTaskStartTime", "specialTaskEndTime", "createdAt", "updatedAt")
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (assignment_id, EVENT_ID, staff_id, tables, 
                      staff_info['shift_start'], staff_info['shift_end'], now, now))
                total_assignments += 1
            else:
                not_found_staff.append(staff_info['name'])
        
        print(f"  ✅ {group_name}: {len(tables)} masa, {len(staff_list)} personel")
        group_num += 1
    
    local_conn.commit()
    
    print(f"\n{'=' * 60}")
    print(f"✅ TOPLAM: {group_num - 1} grup, {total_assignments} personel ataması")
    
    if not_found_staff:
        print(f"\n⚠️ Bulunamayan personeller ({len(not_found_staff)}):")
        for name in set(not_found_staff):
            print(f"   - {name}")
    
    # Bağlantıyı kapat
    local_cur.close()
    local_conn.close()

if __name__ == "__main__":
    main()
