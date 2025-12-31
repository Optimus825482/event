import psycopg2
import uuid

# Loca grupları ve personel atamaları
LOCA_GROUPS = [
    {
        "name": "LOCA 1-2",
        "locas": ["1", "2"],  # locaName değerleri
        "staff": [
            {"name": "RUMEYSA ADANUR", "shift": "16:00-06:00"},
            {"name": "FATMA SOYAK", "shift": "12:00-06:00"},
        ]
    },
    {
        "name": "LOCA 3A-3B",
        "locas": ["3A", "3B"],
        "staff": [
            {"name": "PINAR BAL", "shift": "16:00-06:00"},
            {"name": "TATIBUBU", "shift": "16:00-06:00"},
        ]
    },
    {
        "name": "LOCA 4-5",
        "locas": ["4", "5"],
        "staff": [
            {"name": "GAMZE TÜRK", "shift": "16:00-06:00"},
            {"name": "HANDE KAYHAN", "shift": "19:00-06:00"},
        ]
    },
    {
        "name": "LOCA 6-7",
        "locas": ["6", "7"],
        "staff": [
            {"name": "VIOLETTA", "shift": "16:00-06:00"},
            {"name": "MELİSA ŞAHİN", "shift": "16:00-06:00"},
        ]
    },
    {
        "name": "LOCA 8A-8B",
        "locas": ["8A", "8B"],
        "staff": [
            {"name": "FİDAN ÇEVİK", "shift": "12:00-06:00"},
            {"name": "AGİ", "shift": "12:00-06:00"},
        ]
    },
    {
        "name": "LOCA 9-10",
        "locas": ["9A", "9B"],  # 9A ve 9B var, 10 yok - 9A-9B olarak ayarlıyorum
        "staff": [
            {"name": "PELİN ÜNAL", "shift": "16:00-06:00"},
            {"name": "SUDE SERTTAŞ", "shift": "16:00-06:00"},
        ]
    },
]

EVENT_ID = "4d9fb75e-dbcb-4b26-9823-28ecac3e421b"

# Loca tableNumber mapping (locaName -> tableNumber)
LOCA_TABLE_NUMBERS = {
    "1": "1011",
    "2": "1010",
    "3A": "1009",
    "3B": "1008",
    "4": "1007",
    "5": "1006",
    "6": "1005",
    "7": "1004",
    "8A": "1003",
    "8B": "1002",
    "9A": "1001",
    "9B": "1000",
}

def setup_local():
    conn = psycopg2.connect(
        host="localhost",
        port=5432,
        database="eventflow",
        user="postgres",
        password="518518Erkan"
    )
    cur = conn.cursor()
    
    # Mevcut personelleri al
    cur.execute("SELECT id, \"fullName\" FROM staff WHERE \"isActive\" = true")
    personnel = {row[1].upper(): row[0] for row in cur.fetchall()}
    
    print(f"📋 {len(personnel)} aktif personel bulundu")
    
    # Loca gruplarını oluştur
    for group in LOCA_GROUPS:
        group_id = str(uuid.uuid4())
        
        # Loca tableNumber'larını al
        table_ids = []
        for loca_name in group["locas"]:
            if loca_name in LOCA_TABLE_NUMBERS:
                table_ids.append(LOCA_TABLE_NUMBERS[loca_name])
        
        if not table_ids:
            print(f"⚠️ {group['name']} için loca bulunamadı")
            continue
        
        # Grup oluştur
        cur.execute("""
            INSERT INTO table_groups (id, "eventId", name, color, "tableIds", "groupType", "sortOrder")
            VALUES (%s, %s, %s, %s, %s, 'loca', 100)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                "tableIds" = EXCLUDED."tableIds"
            RETURNING id
        """, (group_id, EVENT_ID, group["name"], "#ec4899", table_ids))
        
        print(f"✅ {group['name']} grubu oluşturuldu: {table_ids}")
        
        # Personel atamalarını yap
        for staff in group["staff"]:
            staff_name = staff["name"].upper()
            shift_parts = staff["shift"].split("-")
            shift_start = shift_parts[0]
            shift_end = shift_parts[1]
            
            # Personeli bul
            staff_id = None
            for name, pid in personnel.items():
                if staff_name in name or name in staff_name:
                    staff_id = pid
                    break
            
            if staff_id:
                # event_staff_assignments'a ekle - önce var mı kontrol et
                cur.execute("""
                    SELECT id FROM event_staff_assignments 
                    WHERE "eventId" = %s AND "staffId" = %s
                """, (EVENT_ID, staff_id))
                existing = cur.fetchone()
                
                if existing:
                    cur.execute("""
                        UPDATE event_staff_assignments 
                        SET "tableIds" = %s, "shiftStart" = %s, "shiftEnd" = %s
                        WHERE "eventId" = %s AND "staffId" = %s
                    """, (table_ids, shift_start, shift_end, EVENT_ID, staff_id))
                else:
                    cur.execute("""
                        INSERT INTO event_staff_assignments ("eventId", "staffId", "tableIds", "shiftStart", "shiftEnd")
                        VALUES (%s, %s, %s, %s, %s)
                    """, (EVENT_ID, staff_id, table_ids, shift_start, shift_end))
                print(f"   👤 {staff['name']} atandı ({shift_start}-{shift_end})")
            else:
                print(f"   ⚠️ {staff['name']} bulunamadı - ekstra personel olarak ekleniyor")
                # Ekstra personel olarak ekle
                import json
                cur.execute("""
                    INSERT INTO event_extra_staff (id, event_id, full_name, position, role, shift_start, shift_end, assigned_tables, sort_order, is_active)
                    VALUES (%s, %s, %s, 'Garson', 'waiter', %s, %s, %s::jsonb, 0, true)
                """, (str(uuid.uuid4()), EVENT_ID, staff["name"], shift_start, shift_end, json.dumps(table_ids)))
                print(f"   👤 {staff['name']} ekstra personel olarak eklendi")
    
    conn.commit()
    cur.close()
    conn.close()
    print("\n✅ Local DB güncellendi")

if __name__ == "__main__":
    setup_local()
