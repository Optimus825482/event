"""
SİBEL CAN CASINO YILBAŞI GALASI - Personel Eşleştirme Kontrolü
Staff tablosunda arama yapar, bulunamayanlar için benzerlik oranı hesaplar
"""

import psycopg2
from difflib import SequenceMatcher

# Coolify DB bağlantısı
conn = psycopg2.connect(
    host='dpg-ctop5qdds78s73a1r7eg-a.frankfurt-postgres.render.com',
    port=5432,
    database='eventflow_db',
    user='eventflow_user',
    password='Xt4w8sLmPqR9vN2jK7hY3cF6bA1dE5gH'
)
cur = conn.cursor()

# Personel listesi (isim, masalar, vardiya)
PERSONNEL_LIST = [
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
    # ("ŞEVVAL EROL", ["6","7","8","16","17","18"], "16:00-00:00"),  # ZATEN EKLENDİ
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

def normalize_name(name):
    """İsmi normalize et"""
    return name.upper().strip().replace("  ", " ")

def similarity(a, b):
    """İki string arasındaki benzerlik oranı"""
    return SequenceMatcher(None, normalize_name(a), normalize_name(b)).ratio() * 100

def find_best_match(name, staff_list):
    """En iyi eşleşmeyi bul"""
    best_match = None
    best_score = 0
    
    for staff in staff_list:
        score = similarity(name, staff[1])  # fullName
        if score > best_score:
            best_score = score
            best_match = staff
    
    return best_match, best_score

# Staff tablosundan tüm personelleri al
cur.execute('SELECT id, "fullName", "sicilNo", position, department FROM staff WHERE "isActive" = true')
all_staff = cur.fetchall()

print("=" * 100)
print("SİBEL CAN CASINO YILBAŞI GALASI - Personel Eşleştirme Raporu")
print("=" * 100)

found = []
not_found = []

for name, tables, shift in PERSONNEL_LIST:
    # Tam eşleşme ara
    exact_match = None
    for staff in all_staff:
        if normalize_name(staff[1]) == normalize_name(name):
            exact_match = staff
            break
    
    if exact_match:
        found.append((name, exact_match, tables, shift, 100))
    else:
        # Benzerlik ara
        best_match, score = find_best_match(name, all_staff)
        not_found.append((name, best_match, tables, shift, score))

# Bulunanlar
print(f"\n✅ BULUNAN PERSONELLER ({len(found)} kişi)")
print("-" * 100)
for name, staff, tables, shift, score in found:
    print(f"  ✓ {name:<30} | Sicil: {staff[2]:<6} | Masalar: {','.join(tables):<20} | Vardiya: {shift}")

# Bulunamayanlar
print(f"\n❌ BULUNAMAYAN PERSONELLER ({len(not_found)} kişi)")
print("-" * 100)
print(f"{'LİSTEDEKİ İSİM':<30} | {'EN YAKIN EŞLEŞME':<30} | {'BENZERLİK':>10} | MASALAR")
print("-" * 100)

for name, best_match, tables, shift, score in sorted(not_found, key=lambda x: -x[4]):
    match_name = best_match[1] if best_match else "YOK"
    match_sicil = best_match[2] if best_match else "-"
    print(f"  {name:<30} | {match_name:<30} | %{score:>6.1f}    | {','.join(tables)} | {shift}")

print("\n" + "=" * 100)
print(f"ÖZET: {len(found)} bulundu, {len(not_found)} bulunamadı")
print("=" * 100)

cur.close()
conn.close()
