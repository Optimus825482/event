"""
57 Personelin tamamını kontrol et - eksikleri bul
"""
import psycopg2

# Senin verdiğin 57 personel listesi
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

conn = psycopg2.connect(host='localhost', port=5432, database='eventflow', user='postgres', password='518518Erkan')
cur = conn.cursor()

# Tüm staff'ları al
cur.execute('SELECT id, "fullName" FROM users WHERE role = %s', ('staff',))
all_users = {row[1].upper().strip(): (row[0], row[1]) for row in cur.fetchall()}

print("=" * 80)
print("57 PERSONEL ANALİZİ - EKSİK VE BENZERLİK KONTROLÜ")
print("=" * 80)

found = []
not_found = []

for name, tables, shift in ALL_STAFF:
    name_upper = name.upper().strip()
    
    # Tam eşleşme
    if name_upper in all_users:
        found.append((name, all_users[name_upper][1], tables, shift))
        continue
    
    # Benzer isim ara
    similar = None
    for db_name in all_users.keys():
        # İlk ve son isim parçalarını kontrol et
        name_parts = name_upper.split()
        if len(name_parts) >= 1:
            if name_parts[0] in db_name or (len(name_parts) > 1 and name_parts[-1] in db_name):
                similar = all_users[db_name][1]
                break
    
    not_found.append((name, similar, tables, shift))

print(f"\n✓ BULUNAN: {len(found)} personel")
print(f"✗ BULUNAMAYAN: {len(not_found)} personel\n")

print("-" * 80)
print("BULUNAMAYAN PERSONELLER VE BENZERLİKLER:")
print("-" * 80)
for name, similar, tables, shift in not_found:
    if similar:
        print(f"  {name:25} -> Benzer: {similar}")
    else:
        print(f"  {name:25} -> DB'de yok!")

cur.close()
conn.close()
