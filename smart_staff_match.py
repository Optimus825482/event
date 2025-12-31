"""
Akıllı Personel Eşleştirme - Türkçe karakter, kısaltma ve boşluk toleranslı
"""
import psycopg2
import uuid
import unicodedata
import re

EVENT_ID = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'

# Vardiya ID'leri
SHIFTS = {
    "12:00-06:00": "a1000001-0000-0000-0000-000000000001",
    "16:00-00:00": "a1000001-0000-0000-0000-000000000002",
    "16:00-06:00": "a1000001-0000-0000-0000-000000000003",
    "17:00-00:00": "a1000001-0000-0000-0000-000000000004",
    "19:00-00:00": "a1000001-0000-0000-0000-000000000005",
    "19:00-06:00": "a1000001-0000-0000-0000-000000000006",
    "20:00-00:00": "a1000001-0000-0000-0000-000000000007",
    "20:00-02:00": "a1000001-0000-0000-0000-000000000008",
}

# Kısaltma açılımları
ABBREVIATIONS = {
    "M.": "MEHMET",
    "M.ALİ": "MEHMET ALİ",
    "M. ALİ": "MEHMET ALİ",
    "M.AKİF": "MEHMET AKİF",
    "M. AKİF": "MEHMET AKİF",
}

# 57 Personel listesi
ALL_STAFF = [
    ("MAHPERİ KURT", ["1","2","3","11","12"], "20:00-02:00"),
    ("Tuğçe Kirenli", ["101","116","117"], "17:00-00:00"),
    ("SALİH SEVİKA", ["101","116","117"], "20:00-02:00"),
    ("RAMAZAN NURYA", ["102","103","118","119"], "20:00-00:00"),
    ("ÖZGÜR ÖZGÜN", ["104","105","120","121"], "16:00-00:00"),
    ("Cihan Erdoğan", ["104","105","120","121"], "17:00-00:00"),
    ("YAŞAR ATAMKOÇYİĞİT", ["106","107","122","123"], "12:00-06:00"),
    ("Ali Gezer", ["106","107","122","123"], "17:00-00:00"),
    ("FURKAN YILDIRIM", ["108","109","124","125"], "12:00-06:00"),
    ("Halit Bağış", ["108","109","124","125"], "17:00-00:00"),
    ("ERANCAN TURAN", ["110","111","126","127"], "20:00-00:00"),
    ("Bilal Iqbal", ["110","111","126","127"], "17:00-00:00"),
    ("Orhan Atlı", ["112","113","128","129"], "17:00-00:00"),
    ("EREN ÖNDER", ["114","115","130","131"], "20:00-02:00"),
    ("Ramazan Doğanay", ["114","115","130","131"], "17:00-00:00"),
    ("Nur Absal", ["132","133","147","148"], "17:00-00:00"),
    ("SEFA FARUK", ["132","33","147","148"], "12:00-06:00"),
    ("MUSTAFA BAŞKALE", ["134","135","149","150"], "20:00-02:00"),
    ("Sergen Elmas", ["134","135","149","150"], "17:00-00:00"),
    ("UGUR CAN DELİBAŞ", ["136","137","151","152"], "20:00-00:00"),
    ("Salman Ali", ["136","137","151","152"], "17:00-00:00"),
    ("EMİRHAN BOYRAZ", ["138","139","140","141"], "16:00-00:00"),
    ("Muhammed Abdullah", ["138","139","140","141"], "17:00-00:00"),
    ("BÜNYAMİN AYDIN", ["142","143","153","154"], "16:00-06:00"),
    ("Muhammed Wassem", ["142","143","153","154"], "17:00-00:00"),
    ("SİBEL ATASOY", ["144","145","146","155","156","157"], "16:00-06:00"),
    ("ONURCAN KOYUN", ["144","145","146","155","156","157"], "16:00-06:00"),
    ("Hüseyin Tülegen", ["144","145","146","155","156","157"], "17:00-00:00"),
    ("FERYAL YAMAN", ["159","45","46","160","59","60"], "20:00-00:00"),
    ("ZEYNEP OKUR", ["21","22","23","158","31","32"], "19:00-00:00"),
    ("OĞUZHAN ELMAS", ["24","25","33","34","35"], "16:00-06:00"),
    ("İNANÇ KOÇAK", ["26","27","40","41"], "16:00-06:00"),
    ("TUGBA ILBAY", ["28","29","42","43"], "19:00-00:00"),
    ("SILA KUVAT", ["30","162","44","163"], "19:00-00:00"),
    ("AZİZ DEMHAT", ["36","37","50","51"], "12:00-06:00"),
    ("CANER OZKAN KUTLU", ["36","37","50","51"], "16:00-06:00"),
    ("YUSUF ŞAHİN", ["38","39","52","53"], "16:00-06:00"),
    ("MEHMET KOÇAK", ["38","39","52","53"], "16:00-06:00"),
    ("FERAY YAKICI", ["4","5","13","14","15"], "16:00-00:00"),
    ("EZGİ KAŞIKÇI", ["4","5","13","14","15"], "16:00-06:00"),
    ("M.ALİ KARASU", ["47","48","61","62"], "19:00-06:00"),
    ("HAKAN CİNTOSUN", ["49","63","64"], "20:00-00:00"),
    ("KAAN TONYALIOĞLU", ["54","65","66"], "20:00-00:00"),
    ("KAZIM KOCA", ["55","56","67","68"], "19:00-00:00"),
    ("ONUR NAMA", ["57","58","69","70","164"], "20:00-00:00"),
    ("ŞEVVAL EROL", ["6","7","8","16","17","18"], "16:00-00:00"),
    ("M. AKİF ŞİMŞEK", ["63","64","65","66"], "16:00-06:00"),
    ("KEREM ERTÜRK", ["71","72","86","87"], "19:00-06:00"),
    ("AYTEKİN SARITOPRAK", ["73","74","88","89"], "19:00-06:00"),
    ("BARIŞ TÜZÜN", ["75","76","90","91"], "16:00-00:00"),
    ("AHMET CAN FINDICAK", ["77","78","92","93"], "16:00-00:00"),
    ("ÖMER İNCE", ["77","78","92","93"], "16:00-06:00"),
    ("Ahmet Deste", ["77","78","92","93"], "17:00-00:00"),
    ("ALİ DÖNMEZ", ["79","80","94","95"], "16:00-06:00"),
    ("CAFER MELİH YEL", ["81","82","96","97"], "20:00-00:00"),
    ("MEHMET YILDIRIM", ["83","84","85","98","99","100"], "19:00-06:00"),
    ("YILDIZ AĞIRMAN", ["9","10","19","20","161"], "20:00-00:00"),
]

def normalize_turkish(text):
    """Türkçe karakterleri ASCII'ye çevir ve normalize et"""
    tr_map = {
        'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U',
        'ş': 's', 'Ş': 'S', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
        'â': 'a', 'Â': 'A', 'î': 'i', 'Î': 'I', 'û': 'u', 'Û': 'U'
    }
    for tr, en in tr_map.items():
        text = text.replace(tr, en)
    return text.upper().strip()

def expand_abbreviations(name):
    """Kısaltmaları aç"""
    for abbr, full in ABBREVIATIONS.items():
        if name.upper().startswith(abbr.upper()):
            name = full + name[len(abbr):]
    return name

def clean_name(name):
    """İsmi temizle - boşlukları, noktalama işaretlerini kaldır"""
    name = expand_abbreviations(name)
    name = normalize_turkish(name)
    name = re.sub(r'[^A-Z]', '', name)  # Sadece harfler
    return name

def similarity_score(name1, name2):
    """İki isim arasındaki benzerlik skoru"""
    clean1 = clean_name(name1)
    clean2 = clean_name(name2)
    
    # Tam eşleşme
    if clean1 == clean2:
        return 100
    
    # Biri diğerini içeriyor
    if clean1 in clean2 or clean2 in clean1:
        return 90
    
    # Kelime bazlı eşleşme
    words1 = set(normalize_turkish(name1).split())
    words2 = set(normalize_turkish(name2).split())
    common = words1 & words2
    if len(common) >= 2:
        return 80
    if len(common) == 1 and len(list(common)[0]) > 3:
        return 60
    
    return 0

def find_best_match(search_name, db_users):
    """En iyi eşleşmeyi bul"""
    best_match = None
    best_score = 0
    
    for db_name, (user_id, full_name) in db_users.items():
        score = similarity_score(search_name, full_name)
        if score > best_score:
            best_score = score
            best_match = (user_id, full_name, score)
    
    return best_match if best_score >= 60 else None

def main():
    conn = psycopg2.connect(host='localhost', port=5432, database='eventflow', user='postgres', password='518518Erkan')
    cur = conn.cursor()
    
    # Tüm staff'ları al
    cur.execute('SELECT id, "fullName" FROM users WHERE role = %s', ('staff',))
    db_users = {row[1]: (row[0], row[1]) for row in cur.fetchall()}
    
    print("=" * 90)
    print("AKILLI PERSONEL EŞLEŞTİRME - 57 Personel")
    print("=" * 90)
    
    # Mevcut atamaları temizle
    cur.execute('DELETE FROM event_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
    conn.commit()
    print("Mevcut atamalar temizlendi.\n")
    
    matched = []
    not_matched = []
    
    for name, tables, shift in ALL_STAFF:
        match = find_best_match(name, db_users)
        
        if match:
            user_id, db_name, score = match
            matched.append((name, db_name, score, tables, shift, user_id))
        else:
            not_matched.append((name, tables, shift))
    
    # Eşleşenleri ekle
    print(f"✓ EŞLEŞTİRİLEN: {len(matched)} personel")
    print("-" * 90)
    
    for name, db_name, score, tables, shift, user_id in matched:
        shift_id = SHIFTS.get(shift)
        if shift_id:
            cur.execute('''
                INSERT INTO event_staff_assignments (id, "eventId", "staffId", "tableIds", "shiftId", "isActive", "assignmentType", "sortOrder")
                VALUES (%s, %s, %s, %s, %s, true, 'table', 0)
            ''', (str(uuid.uuid4()), EVENT_ID, str(user_id), tables, shift_id))
            
            match_indicator = "✓" if score == 100 else f"~{score}%"
            print(f"  {match_indicator} {name:25} -> {db_name:25} | Masalar: {','.join(tables[:3])}...")
    
    conn.commit()
    
    print(f"\n✗ EŞLEŞTİRİLEMEYEN: {len(not_matched)} personel")
    print("-" * 90)
    for name, tables, shift in not_matched:
        print(f"  ✗ {name:25} | Masalar: {','.join(tables)} | Vardiya: {shift}")
    
    print("\n" + "=" * 90)
    print(f"SONUÇ: {len(matched)} atama yapıldı, {len(not_matched)} personel DB'de bulunamadı")
    print("=" * 90)
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
