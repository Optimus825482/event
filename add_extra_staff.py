#!/usr/bin/env python3
"""
Sibel Can Casino Yılbaşı Galası - Ekstra Personel Ekleme
"""

import psycopg2
import json

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'eventflow',
    'user': 'postgres',
    'password': '518518Erkan'
}

EVENT_ID = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'

# Ekstra personel listesi (isim, masalar, vardiya_başlangıç, vardiya_bitiş)
EXTRA_STAFF = [
    ("MERYEM ZAMANI", ['1','2','3','11','12'], "17:00", "04:00"),
    ("ZEHRA ZAMANI", ['101','116','117'], "17:00", "04:00"),
    ("EYLÜL KILÇIK", ['102','103','118','119'], "17:00", "04:00"),
    ("MERT EGE", ['104','105','120','121'], "17:00", "04:00"),
    ("DİLEK GULBAY", ['110','111','126','127'], "17:00", "04:00"),
    ("BEGENCY", ['114','115','130','131'], "17:00", "04:00"),
    ("NUR SEDA", ['134','135','149','150'], "17:00", "04:00"),
    ("ELİF ÖZYAVRU", ['136','137','151','152'], "17:00", "04:00"),
    ("BELMA NUR", ['138','139','140','141'], "17:00", "04:00"),
    ("ÇİĞDEM YALÇIN", ['142','143','153','154'], "17:00", "04:00"),
    ("REVSAN SAMUR", ['144','145','146','155','156','157'], "17:00", "04:00"),
    ("MUSTAFA YAŞİN", ['144','145','146','155','156','157'], "17:00", "04:00"),
    ("MEHMET ÖZDEMİR", ['159','45','46','160','59','60'], "17:00", "04:00"),
    ("BUSENUR ÖZDEMİR", ['21','22','23','158','31','32'], "17:00", "04:00"),
    ("KERİM MAKSUDOV", ['24','25','33','34','35'], "17:00", "04:00"),
    ("FATMA EBRAR", ['26','27','40','41'], "17:00", "04:00"),
    ("YUSUF TEKİN", ['28','29','42','43'], "17:00", "04:00"),
    ("CANSU AKSAL", ['30','162','44','163'], "17:00", "04:00"),
    ("EBRU EDE", ['38','39','52','53'], "17:00", "04:00"),
    ("MUZAFFER AZAD", ['4','5','13','14','15'], "17:00", "04:00"),
    ("EMİNE GÜLAY", ['49','63','64'], "17:00", "04:00"),
    ("YUSUF BARAN", ['54','65','66'], "17:00", "04:00"),
    ("MURAT AKAY", ['55','56','67','68'], "17:00", "04:00"),
    ("MEHMET EFE", ['57','58','69','70','164'], "17:00", "04:00"),
    ("SÜMEYYE DAŞGIN", ['6','7','8','16','17','18'], "17:00", "04:00"),
    ("DANIYAR", ['63','64','65','66'], "17:00", "04:00"),
    ("RUMEYSA TUĞÇE", ['75','76','90','91'], "17:00", "04:00"),
    ("SÜNNET BEGENCOV", ['77','78','92','93'], "17:00", "04:00"),
    ("DAVUT EREĞLİ", ['81','82','96','97'], "17:00", "04:00"),
    ("NUR SENA", ['9','10','19','20','161'], "17:00", "04:00"),
]

# Renkler (her personele farklı renk)
COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#fb7185', '#f472b6', '#e879f9',
    '#c084fc', '#a78bfa', '#818cf8', '#6366f1', '#4f46e5',
    '#4338ca', '#3730a3', '#312e81', '#1e1b4b', '#0f172a',
]

def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    print("=" * 60)
    print("SİBEL CAN - EKSTRA PERSONEL EKLEME")
    print("=" * 60)
    
    # Önce bu etkinliğin mevcut ekstra personellerini temizle
    cursor.execute('DELETE FROM event_extra_staff WHERE event_id = %s', (EVENT_ID,))
    print("✓ Mevcut ekstra personeller temizlendi")
    
    # Ekstra personelleri ekle
    for idx, (name, tables, shift_start, shift_end) in enumerate(EXTRA_STAFF):
        color = COLORS[idx % len(COLORS)]
        
        cursor.execute('''
            INSERT INTO event_extra_staff 
            (event_id, full_name, position, role, shift_start, shift_end, color, assigned_tables, sort_order, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, true)
        ''', (
            EVENT_ID,
            name,
            'Ekstra Personel',
            'Garson',
            shift_start,
            shift_end,
            color,
            json.dumps(tables),
            idx + 1
        ))
    
    conn.commit()
    
    # Sonuç
    cursor.execute('SELECT COUNT(*) FROM event_extra_staff WHERE event_id = %s', (EVENT_ID,))
    count = cursor.fetchone()[0]
    
    print(f"✓ {count} ekstra personel eklendi")
    
    # Liste
    cursor.execute('''
        SELECT full_name, assigned_tables, shift_start, shift_end 
        FROM event_extra_staff 
        WHERE event_id = %s 
        ORDER BY sort_order
    ''', (EVENT_ID,))
    
    print("\nEklenen ekstra personeller:")
    for row in cursor.fetchall():
        tables = row[1] if row[1] else []
        print(f"  {row[0]}: Masalar {tables}, {row[2]}-{row[3]}")
    
    cursor.close()
    conn.close()
    print("\n✓ İşlem tamamlandı!")

if __name__ == "__main__":
    main()
