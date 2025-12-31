"""
Akıllı Personel Eşleştirme FINAL - Sadece Kesin Eşleşmeler
- Tam isim eşleşmesi veya
- Kısaltma açılımı ile tam eşleşme (M. AKİF -> MEHMET AKİF)
- Türkçe karakter ve boşluk toleransı
- YANLIŞ EŞLEŞMELERİ ÖNLE
"""
import psycopg2
import uuid
import re

EVENT_ID = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'

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

def normalize(text):
    """Türkçe karakterleri ASCII'ye çevir, boşlukları temizle, büyük harfe çevir"""
    tr_map = {
        'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U',
        'ş': 's', 'Ş': 'S', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
        'â': 'a', 'Â': 'A', 'î': 'i', 'Î': 'I', 'û': 'u', 'Û': 'U'
    }
    for tr, en in tr_map.items():
        text = text.replace(tr, en)
    # Birden fazla boşluğu tek boşluğa çevir
    text = re.sub(r'\s+', ' ', text.upper().strip())
    return text

def get_all_variants(name):
    """İsmin tüm olası varyantlarını üret"""
    variants = set()
    name = name.strip()
    
    # Orijinal
    variants.add(normalize(name))
    
    # Boşluksuz
    variants.add(normalize(name).replace(' ', ''))
    
    # M. AKİF -> MEHMET AKİF
    # M.ALİ -> MEHMET ALİ
    expanded = name.upper()
    expanded = re.sub(r'^M\.\s*AKİF', 'MEHMET AKIF', expanded)
    expanded = re.sub(r'^M\.\s*ALİ', 'MEHMET ALI', expanded)
    expanded = re.sub(r'^M\.ALİ', 'MEHMET ALI', expanded)
    expanded = re.sub(r'^M\.AKİF', 'MEHMET AKIF', expanded)
    variants.add(normalize(expanded))
    variants.add(normalize(expanded).replace(' ', ''))
    
    # UGUR CAN -> UGURCAN
    merged = normalize(name).replace(' ', '')
    variants.add(merged)
    
    # AHMET CAN FINDICAK -> AHMETCAN FINDICAK
    parts = normalize(name).split()
    if len(parts) >= 3:
        variants.add(parts[0] + parts[1] + ' ' + ' '.join(parts[2:]))
    
    return variants

def find_exact_match(search_name, db_users):
    """Tam eşleşme bul"""
    search_variants = get_all_variants(search_name)
    
    for db_name, user_id in db_users.items():
        db_variants = get_all_variants(db_name)
        
        # Herhangi bir varyant eşleşiyor mu?
        if search_variants & db_variants:
            return (user_id, db_name)
    
    return None

def main():
    conn = psycopg2.connect(
        host='localhost', port=5432, database='eventflow', 
        user='postgres', password='518518Erkan'
    )
    cur = conn.cursor()
    
    cur.execute('SELECT id, "fullName" FROM users WHERE role = %s', ('staff',))
    db_users = {row[1]: row[0] for row in cur.fetchall()}
    
    print("=" * 100)
    print("AKILLI PERSONEL EŞLEŞTİRME FINAL - Sadece Kesin Eşleşmeler")
    print("=" * 100)
    
    # Mevcut atamaları temizle
    cur.execute('DELETE FROM event_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
    conn.commit()
    print("Mevcut atamalar temizlendi.\n")
    
    matched = []
    not_matched = []
    
    for name, tables, shift in ALL_STAFF:
        match = find_exact_match(name, db_users)
        
        if match:
            user_id, db_name = match
            matched.append((name, db_name, tables, shift, user_id))
        else:
            not_matched.append((name, tables, shift))
    
    # Eşleşenleri ekle
    print(f"✓ EŞLEŞTİRİLEN: {len(matched)} personel")
    print("-" * 100)
    
    for name, db_name, tables, shift, user_id in matched:
        shift_id = SHIFTS.get(shift)
        if shift_id:
            cur.execute('''
                INSERT INTO event_staff_assignments (id, "eventId", "staffId", "tableIds", "shiftId", "isActive", "assignmentType", "sortOrder")
                VALUES (%s, %s, %s, %s, %s, true, 'table', 0)
            ''', (str(uuid.uuid4()), EVENT_ID, str(user_id), tables, shift_id))
            
            print(f"  ✓ {name:25} -> {db_name:25} | Masalar: {','.join(tables[:3])}... | {shift}")
    
    conn.commit()
    
    print(f"\n✗ EŞLEŞTİRİLEMEYEN: {len(not_matched)} personel (DB'de yok)")
    print("-" * 100)
    for name, tables, shift in not_matched:
        print(f"  ✗ {name:25} | Masalar: {','.join(tables)} | Vardiya: {shift}")
    
    print("\n" + "=" * 100)
    print(f"SONUÇ: {len(matched)} kesin atama, {len(not_matched)} personel DB'de bulunamadı")
    print("=" * 100)
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
