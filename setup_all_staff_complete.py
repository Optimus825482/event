import psycopg2

EVENT_ID = "4d9fb75e-dbcb-4b26-9823-28ecac3e421b"

# Tüm personel listesi: (ad, masalar, vardiya_başlangıç, vardiya_bitiş)
# K = 06:00 (kapanış)
# İsimler staff tablosundaki tam isimlerle eşleştirildi
STAFF_LIST = [
    ("Mahperi Kurt", ["1", "2", "3", "11", "12"], "20:00", "02:00"),
    ("Tuğçe Kirenli", ["101", "116", "117"], "17:00", "00:00"),
    ("Salih Sevik", ["101", "116", "117"], "20:00", "02:00"),
    ("Ramazan Nuryagdyyev", ["102", "103", "118", "119"], "20:00", "00:00"),
    ("Özgür Özgün", ["104", "105", "120", "121"], "16:00", "00:00"),
    ("Cihan Erdoğan", ["104", "105", "120", "121"], "17:00", "00:00"),
    ("Yaşar Atamkoçyiğit", ["106", "107", "122", "123"], "12:00", "06:00"),
    ("Ali Gezer", ["106", "107", "122", "123"], "17:00", "00:00"),
    ("Furkan Yıldırım", ["108", "109", "124", "125"], "12:00", "06:00"),
    ("Halit Bağış", ["108", "109", "124", "125"], "17:00", "00:00"),
    ("Erencan Turan", ["110", "111", "126", "127"], "20:00", "00:00"),
    ("Bilal Iqbal", ["110", "111", "126", "127"], "17:00", "00:00"),
    ("Orhan Atlı", ["112", "113", "128", "129"], "17:00", "00:00"),
    ("Eren Önder", ["114", "115", "130", "131"], "20:00", "02:00"),
    ("Ramazan Doğanay", ["114", "115", "130", "131"], "17:00", "00:00"),
    ("Nur Absal", ["132", "133", "147", "148"], "17:00", "00:00"),
    ("Sefa Faruk Kurt", ["132", "33", "147", "148"], "12:00", "06:00"),
    ("Mustafa Başkale", ["134", "135", "149", "150"], "20:00", "02:00"),
    ("Sergen Elmas", ["134", "135", "149", "150"], "17:00", "00:00"),
    ("Uğur Can Delibaş", ["136", "137", "151", "152"], "20:00", "00:00"),
    ("Salman Ali", ["136", "137", "151", "152"], "17:00", "00:00"),
    ("Emirhan Boyraz", ["138", "139", "140", "141"], "16:00", "00:00"),
    ("Muhammed Abdullah", ["138", "139", "140", "141"], "17:00", "00:00"),
    ("Bünyamin Aydın", ["142", "143", "153", "154"], "16:00", "06:00"),
    ("Muhammed Wassem", ["142", "143", "153", "154"], "17:00", "00:00"),
    ("Sibel Atasoy", ["144", "145", "146", "155", "156", "157"], "16:00", "06:00"),
    ("Onurcan Koyun", ["144", "145", "146", "155", "156", "157"], "16:00", "06:00"),
    ("Hüseyin Tülegen", ["144", "145", "146", "155", "156", "157"], "17:00", "00:00"),
    ("Feryal Yaman", ["159", "45", "46", "160", "59", "60"], "20:00", "00:00"),
    ("Zeynep Ebru Okur", ["21", "22", "23", "158", "31", "32"], "19:00", "00:00"),
    ("Oğuzhan Elmas", ["24", "25", "33", "34", "35"], "16:00", "06:00"),
    ("İnanç Koçak", ["26", "27", "40", "41"], "16:00", "06:00"),
    ("Tuğba İlbay", ["28", "29", "42", "43"], "19:00", "00:00"),
    ("Sıla Kuvat", ["30", "162", "44", "163"], "19:00", "00:00"),
    ("Aziz Demhat Yılmaz", ["36", "37", "50", "51"], "12:00", "06:00"),
    ("Caner Özkan Kutlu", ["36", "37", "50", "51"], "16:00", "06:00"),
    ("Yusuf Şahin", ["38", "39", "52", "53"], "16:00", "06:00"),
    ("Mehmet Koçak", ["38", "39", "52", "53"], "16:00", "06:00"),
    ("Feray Yakıcı", ["4", "5", "13", "14", "15"], "16:00", "00:00"),
    ("Ezgi Çağla Kaşıkçı", ["4", "5", "13", "14", "15"], "16:00", "06:00"),
    ("Mehmet Ali Karasu", ["47", "48", "61", "62"], "19:00", "06:00"),
    ("Hakan Cintosun", ["49", "63", "64"], "20:00", "00:00"),
    ("Kaan Tonyalıoğlu", ["54", "65", "66"], "20:00", "00:00"),
    ("Kazım Koca", ["55", "56", "67", "68"], "19:00", "00:00"),
    ("Onur Nama", ["57", "58", "69", "70", "164"], "20:00", "00:00"),
    ("Şevval Erol", ["6", "7", "8", "16", "17", "18"], "16:00", "00:00"),
    ("Mehmet Akif Şimşek", ["63", "64", "65", "66"], "16:00", "06:00"),
    ("Kerem Ertürk", ["71", "72", "86", "87"], "19:00", "06:00"),
    ("Aytekin Sarıtoprak", ["73", "74", "88", "89"], "19:00", "06:00"),
    ("Barış Tüzün", ["75", "76", "90", "91"], "16:00", "00:00"),
    ("Ahmet Can Fındıcak", ["77", "78", "92", "93"], "16:00", "00:00"),
    ("Ömer İnce", ["77", "78", "92", "93"], "16:00", "06:00"),
    ("Mehmet Ali Deste", ["77", "78", "92", "93"], "17:00", "00:00"),
    ("Ali Dönmez", ["79", "80", "94", "95"], "16:00", "06:00"),
    ("Cafer Melih Yel", ["81", "82", "96", "97"], "20:00", "00:00"),
    ("Mehmet Yıldırım", ["83", "84", "85", "98", "99", "100"], "19:00", "06:00"),
    ("Yıldız Ağırman", ["9", "10", "19", "20", "161"], "20:00", "00:00"),
]

def normalize_name(name):
    """İsmi normalize et - büyük/küçük harf ve boşluk düzelt"""
    return name.strip().upper()

def find_staff_id(cur, name):
    """Personel ID'sini bul - çeşitli eşleşme yöntemleri dene"""
    normalized = normalize_name(name)
    
    # 1. Tam eşleşme (case insensitive)
    cur.execute('SELECT id, "fullName" FROM staff WHERE UPPER("fullName") = %s', (normalized,))
    result = cur.fetchone()
    if result:
        return result[0], result[1]
    
    # 2. ILIKE ile parçalı eşleşme
    parts = normalized.split()
    if len(parts) >= 2:
        # İlk ve son isim ile ara
        cur.execute('''
            SELECT id, "fullName" FROM staff 
            WHERE UPPER("fullName") LIKE %s AND UPPER("fullName") LIKE %s
        ''', (f'%{parts[0]}%', f'%{parts[-1]}%'))
        result = cur.fetchone()
        if result:
            return result[0], result[1]
    
    # 3. Sadece ilk isimle ara
    if parts:
        cur.execute('SELECT id, "fullName" FROM staff WHERE UPPER("fullName") LIKE %s', (f'{parts[0]}%',))
        results = cur.fetchall()
        if len(results) == 1:
            return results[0][0], results[0][1]
    
    return None, None

def setup_staff_assignments(conn_params, db_name):
    """Personel atamalarını yap"""
    conn = psycopg2.connect(**conn_params)
    cur = conn.cursor()
    
    print(f"\n{'='*60}")
    print(f"{db_name} - PERSONEL ATAMALARI")
    print(f"{'='*60}")
    
    # Kolonları ekle (varsa hata vermez)
    try:
        cur.execute('ALTER TABLE event_staff_assignments ADD COLUMN IF NOT EXISTS "shiftStart" VARCHAR(10)')
        cur.execute('ALTER TABLE event_staff_assignments ADD COLUMN IF NOT EXISTS "shiftEnd" VARCHAR(10)')
        conn.commit()
    except Exception as e:
        print(f"Kolon ekleme hatası (muhtemelen zaten var): {e}")
        conn.rollback()
    
    # Mevcut atamaları sil
    cur.execute('DELETE FROM event_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
    print(f"Silinen mevcut atama: {cur.rowcount}")
    
    success = 0
    failed = []
    
    for i, (name, tables, shift_start, shift_end) in enumerate(STAFF_LIST, 1):
        staff_id, found_name = find_staff_id(cur, name)
        
        if staff_id:
            cur.execute('''
                INSERT INTO event_staff_assignments 
                ("eventId", "staffId", "tableIds", "shiftStart", "shiftEnd", "sortOrder", "isActive", "assignmentType")
                VALUES (%s, %s, %s, %s, %s, %s, true, 'table')
            ''', (EVENT_ID, staff_id, tables, shift_start, shift_end, i))
            success += 1
            print(f"✓ {name} -> {found_name} | Masalar: {tables} | Vardiya: {shift_start}-{shift_end}")
        else:
            failed.append((name, tables, shift_start, shift_end))
            print(f"✗ {name} BULUNAMADI!")
    
    conn.commit()
    
    print(f"\n{'='*60}")
    print(f"SONUÇ: {success} personel atandı, {len(failed)} başarısız")
    
    if failed:
        print("\nBULUNAMAYAN PERSONELLER:")
        for name, tables, ss, se in failed:
            print(f"  - {name} | Masalar: {tables} | Vardiya: {ss}-{se}")
    
    cur.close()
    conn.close()
    
    return failed

if __name__ == "__main__":
    # Local DB
    local_params = {
        'host': 'localhost',
        'port': 5432,
        'user': 'postgres',
        'password': '518518Erkan',
        'dbname': 'eventflow'
    }
    
    failed_local = setup_staff_assignments(local_params, "LOCAL DB")
    
    print("\n" + "="*60)
    print("TAMAMLANDI!")
    print("="*60)
