"""
SİBEL CAN CASINO YILBAŞI GALASI - Personel Atamaları (Local DB)
Event ID: 4d9fb75e-dbcb-4b26-9823-28ecac3e421b
"""

import psycopg2
import uuid

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="eventflow",
    user="postgres",
    password="518518Erkan"
)
cur = conn.cursor()

EVENT_ID = "4d9fb75e-dbcb-4b26-9823-28ecac3e421b"

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

# Personel atamaları - (isim_pattern, masalar, vardiya)
ASSIGNMENTS = [
    # Grup 5: 106,107,122,123
    ("YAŞAR ATAMKOÇ", ["106","107","122","123"], "12:00-06:00"),
    # Grup 20: 28,29,42,43
    ("TUĞBA ILBAY", ["28","29","42","43"], "19:00-00:00"),
    # Grup 23: 38,39,52,53
    ("YUSUF ŞAHİN", ["38","39","52","53"], "16:00-06:00"),
    # Grup 34: 77,78,92,93
    ("ÖMER İNCE", ["77","78","92","93"], "16:00-06:00"),
    # Grup 39: 132,33,147,148
    ("SEFA FARUK", ["132","33","147","148"], "12:00-06:00"),
    # Grup 15: 144,145,146,155,156,157
    ("ONURCAN KOYUN", ["144","145","146","155","156","157"], "16:00-06:00"),
    # Grup 18: 24,25,33,34,35
    ("OĞUZHAN ELMAS", ["24","25","33","34","35"], "16:00-06:00"),
    # Grup 37: 83,84,85,98,99,100
    ("MEHMET YILDIRIM", ["83","84","85","98","99","100"], "19:00-06:00"),
    # Grup 31: 71,72,86,87
    ("KEREM ERTÜRK", ["71","72","86","87"], "19:00-06:00"),
    # Grup 28: 55,56,67,68
    ("KAZIM KOCA", ["55","56","67","68"], "19:00-00:00"),
    # Grup 27: 54,65,66
    ("KAAN TONYALIOĞLU", ["54","65","66"], "20:00-00:00"),
    # Grup 26: 49,63,64
    ("HAKAN CINTOSUN", ["49","63","64"], "20:00-00:00"),
    # Grup 12: 136,137,151,152
    ("UGURCAN DELİBAŞ", ["136","137","151","152"], "20:00-00:00"),
    # Grup 33: 75,76,90,91
    ("BARIS TÜZÜN", ["75","76","90","91"], "16:00-00:00"),
    # Grup 34: 77,78,92,93 (ikinci personel)
    ("Ahmetcan Fındıcak", ["77","78","92","93"], "16:00-00:00"),
]

def find_staff_id(name_pattern):
    """Personel ID'sini bul"""
    cur.execute("""
        SELECT id, "fullName" FROM users 
        WHERE role = 'staff' AND UPPER("fullName") LIKE %s
        LIMIT 1
    """, (f"%{name_pattern.upper()}%",))
    result = cur.fetchone()
    return result if result else (None, None)

def main():
    print("=" * 60)
    print("SİBEL CAN - Personel Atamaları (Local DB)")
    print("=" * 60)
    
    # Mevcut atamaları temizle
    cur.execute('DELETE FROM event_staff_assignments WHERE "eventId" = %s', (EVENT_ID,))
    conn.commit()
    print("Mevcut atamalar temizlendi.\n")
    
    success = 0
    failed = []
    
    for name_pattern, tables, shift in ASSIGNMENTS:
        staff_id, full_name = find_staff_id(name_pattern)
        
        if not staff_id:
            failed.append(name_pattern)
            print(f"✗ {name_pattern} - BULUNAMADI")
            continue
        
        shift_id = SHIFTS.get(shift)
        if not shift_id:
            print(f"✗ {name_pattern} - Vardiya bulunamadı: {shift}")
            continue
        
        assignment_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO event_staff_assignments 
            (id, "eventId", "staffId", "tableIds", "shiftId", "isActive", "assignmentType", "sortOrder")
            VALUES (%s, %s, %s, %s, %s, true, 'table', 0)
        """, (assignment_id, EVENT_ID, str(staff_id), tables, shift_id))
        
        success += 1
        print(f"✓ {full_name} -> Masalar: {tables} | Vardiya: {shift}")
    
    conn.commit()
    
    print("\n" + "=" * 60)
    print(f"SONUÇ: {success} başarılı, {len(failed)} başarısız")
    if failed:
        print(f"Bulunamayan: {', '.join(failed)}")
    print("=" * 60)
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
