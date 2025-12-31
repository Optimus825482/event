import psycopg2
import json

# Grup-Personel-Masa eşleşmesi (Context'ten alındı)
# Format: (grup_no, personel_adı, masalar)
GROUP_STAFF_MAPPING = [
    (1, "Mahperi Kurt", ["1", "2", "3", "11", "12"]),
    (2, "Tuğçe Yılmaz", ["101", "116", "117"]),  # Tuğçe & Salih
    (3, "Ramazan Nergiz", ["102", "103", "118", "119"]),
    (4, "Özgür Çelik", ["104", "105", "120", "121"]),  # Özgür & Cihan
    (5, "Yaşar Kılıç", ["106", "107", "122", "123"]),  # Yaşar & Ali
    (6, "Furkan Yıldırım", ["108", "109", "124", "125"]),  # Furkan & Halit
    (7, "Erencan Turan", ["110", "111", "126", "127"]),  # Erencan & Bilal
    (8, "Orhan Atlı", ["112", "113", "128", "129"]),
    (9, "Eren Önder", ["114", "115", "130", "131"]),  # Eren & Ramazan D.
    (10, "Nur Absal", ["132", "133", "147", "148"]),  # Nur & Sefa - düzeltilmiş
    (11, "Mustafa Başkale", ["134", "135", "149", "150"]),  # Mustafa & Sergen
    (12, "Uğur Can Yılmaz", ["136", "137", "151", "152"]),  # Uğur Can & Salman
    (13, "Muhammed Abdullah", ["138", "139", "140", "141"]),  # Emirhan & Muhammed A.
    (14, "Muhammed Wassem", ["142", "143", "153", "154"]),  # Bünyamin & Muhammed W.
    (15, "Sibel Yıldız", ["144", "145", "146", "155", "156", "157"]),  # Sibel & Onurcan & Hüseyin
    (16, "Feryal Yaman", ["159", "45", "46", "160", "59", "60"]),
    (17, "Zeynep Okur", ["21", "22", "23", "158", "31", "32"]),
    (18, "Oğuzhan Elmas", ["24", "25", "33", "34", "35"]),
    (19, "İnanç Koçak", ["26", "27", "40", "41"]),
    (20, "Tuğba İlbay", ["28", "29", "42", "43"]),
    (21, "Sıla Kuvat", ["30", "162", "44", "163"]),
    (22, "Caner Özkan Kutlu", ["36", "37", "50", "51"]),  # Aziz & Caner
    (23, "Mehmet Koçak", ["38", "39", "52", "53"]),  # Yusuf & Mehmet K.
    (24, "Feray Yakıcı", ["4", "5", "13", "14", "15"]),  # Feray & Ezgi
    (25, "Mehmet Ali Karasu", ["47", "48", "61", "62"]),
    (26, "Hakan Cintosun", ["49", "63", "64"]),
    (27, "Kaan Tonyalıoğlu", ["54", "65", "66"]),
    (28, "Kazım Koca", ["55", "56", "67", "68"]),
    (29, "Onur Nama", ["57", "58", "69", "70", "164"]),
    (30, "Şevval Erol", ["6", "7", "8", "16", "17", "18"]),
    (31, "Mehmet Akif Şimşek", ["63", "64", "65", "66"]),
    (32, "Kerem Ertürk", ["71", "72", "86", "87"]),
    (33, "Aytekin Sarıtoprak", ["73", "74", "88", "89"]),
    (34, "Barış Tüzün", ["75", "76", "90", "91"]),
    (35, "Ahmet Can Fındıcak", ["77", "78", "92", "93"]),  # Ahmet Can & Ömer & M.Ali D.
    (36, "Ali Dönmez", ["79", "80", "94", "95"]),
    (37, "Cafer Melih Yel", ["81", "82", "96", "97"]),
    (38, "Mehmet Yıldırım", ["83", "84", "85", "98", "99", "100"]),
    (39, "Yıldız Ağırman", ["9", "10", "19", "20", "161"]),
]

EVENT_ID = "4d9fb75e-dbcb-4b26-9823-28ecac3e421b"

def get_staff_id_by_name(cur, name):
    """Personel adına göre ID bul"""
    # Tam eşleşme dene
    cur.execute('SELECT id FROM staff WHERE "fullName" = %s', (name,))
    result = cur.fetchone()
    if result:
        return result[0]
    
    # ILIKE ile dene
    cur.execute('SELECT id, "fullName" FROM staff WHERE "fullName" ILIKE %s', (f"%{name}%",))
    results = cur.fetchall()
    if results:
        # En iyi eşleşmeyi bul
        for r in results:
            if name.lower() in r[1].lower():
                return r[0]
        return results[0][0]
    
    return None

def setup_local_db():
    """Local DB'ye personel atamalarını yap"""
    conn = psycopg2.connect(
        host='localhost',
        port=5432,
        user='postgres',
        password='518518Erkan',
        dbname='eventflow'
    )
    cur = conn.cursor()
    
    print("=" * 60)
    print("LOCAL DB - PERSONEL ATAMALARI")
    print("=" * 60)
    
    # Mevcut atamaları sil
    cur.execute('DELETE FROM event_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
    print(f"Silinen mevcut atama: {cur.rowcount}")
    
    success_count = 0
    failed = []
    
    for grup_no, staff_name, tables in GROUP_STAFF_MAPPING:
        staff_id = get_staff_id_by_name(cur, staff_name)
        
        if staff_id:
            cur.execute('''
                INSERT INTO event_staff_assignments 
                ("eventId", "staffId", "tableIds", "sortOrder", "isActive", "assignmentType")
                VALUES (%s, %s, %s, %s, true, 'table')
            ''', (EVENT_ID, staff_id, tables, grup_no))
            success_count += 1
            print(f"✓ GRUP-{grup_no}: {staff_name} -> Masalar: {tables}")
        else:
            failed.append((grup_no, staff_name, tables))
            print(f"✗ GRUP-{grup_no}: {staff_name} BULUNAMADI!")
    
    conn.commit()
    
    print(f"\n{'=' * 60}")
    print(f"SONUÇ: {success_count} personel atandı, {len(failed)} başarısız")
    
    if failed:
        print("\nBULUNAMAYAN PERSONELLER:")
        for g, n, t in failed:
            print(f"  GRUP-{g}: {n}")
    
    cur.close()
    conn.close()
    
    return failed

if __name__ == "__main__":
    failed = setup_local_db()
    print("\nLocal DB tamamlandı!")
