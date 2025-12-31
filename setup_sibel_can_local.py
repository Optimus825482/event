#!/usr/bin/env python3
"""
Sibel Can Casino Yılbaşı Galası - Local DB'ye Masa Grupları ve Personel Atamaları
Local DB'de table_groups tablosu var (service_table_groups değil!)
"""

import psycopg2
from datetime import datetime
import uuid

# Local veritabanı bağlantısı
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'eventflow',
    'user': 'postgres',
    'password': '518518Erkan'
}

EVENT_ID = '4d9fb75e-dbcb-4b26-9823-28ecac3e421b'

def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    print("=" * 60)
    print("SİBEL CAN CASINO YILBAŞI GALASI - Local DB")
    print("=" * 60)
    
    # Önce mevcut atamaları temizle (Şevval Erol hariç - zaten var)
    cursor.execute('''
        DELETE FROM event_staff_assignments 
        WHERE "eventId" = %s 
        AND "staffId" != '758d1a92-c558-4bca-afbf-42c6c1a7d865'
    ''', (EVENT_ID,))
    
    # table_groups tablosunu temizle (LOCAL'de table_groups var!)
    cursor.execute('''
        DELETE FROM table_groups WHERE "eventId" = %s
    ''', (EVENT_ID,))
    print("✓ Mevcut veriler temizlendi")
    
    # ==================== MASA GRUPLARI ====================
    # Local DB'de table_groups tablosu kullanılıyor (isActive kolonu YOK)
    groups_data = [
        ('a1000001-0001-0001-0001-000000000001', 'Grup 1 - Mahperi Kurt', '#ef4444', ['1','2','3','11','12'], 1),
        ('a1000001-0001-0001-0001-000000000002', 'Grup 2 - Tuğçe & Salih', '#f97316', ['101','116','117'], 2),
        ('a1000001-0001-0001-0001-000000000003', 'Grup 3 - Ramazan N.', '#f59e0b', ['102','103','118','119'], 3),
        ('a1000001-0001-0001-0001-000000000004', 'Grup 4 - Özgür & Cihan', '#eab308', ['104','105','120','121'], 4),
        ('a1000001-0001-0001-0001-000000000005', 'Grup 5 - Yaşar & Ali', '#84cc16', ['106','107','122','123'], 5),
        ('a1000001-0001-0001-0001-000000000006', 'Grup 6 - Furkan & Halit', '#22c55e', ['108','109','124','125'], 6),
        ('a1000001-0001-0001-0001-000000000007', 'Grup 7 - Erencan & Bilal', '#10b981', ['110','111','126','127'], 7),
        ('a1000001-0001-0001-0001-000000000008', 'Grup 8 - Orhan Atlı', '#14b8a6', ['112','113','128','129'], 8),
        ('a1000001-0001-0001-0001-000000000009', 'Grup 9 - Eren & Ramazan D.', '#06b6d4', ['114','115','130','131'], 9),
        ('a1000001-0001-0001-0001-000000000010', 'Grup 10 - Nur & Sefa', '#0ea5e9', ['132','133','147','148','33'], 10),
        ('a1000001-0001-0001-0001-000000000011', 'Grup 11 - Mustafa & Sergen', '#3b82f6', ['134','135','149','150'], 11),
        ('a1000001-0001-0001-0001-000000000012', 'Grup 12 - Uğur Can & Salman', '#6366f1', ['136','137','151','152'], 12),
        ('a1000001-0001-0001-0001-000000000013', 'Grup 13 - Emirhan & Muhammed A.', '#8b5cf6', ['138','139','140','141'], 13),
        ('a1000001-0001-0001-0001-000000000014', 'Grup 14 - Bünyamin & Muhammed W.', '#a855f7', ['142','143','153','154'], 14),
        ('a1000001-0001-0001-0001-000000000015', 'Grup 15 - Sibel & Onurcan & Hüseyin', '#d946ef', ['144','145','146','155','156','157'], 15),
        ('a1000001-0001-0001-0001-000000000016', 'Grup 16 - Feryal Yaman', '#ec4899', ['159','45','46','160','59','60'], 16),
        ('a1000001-0001-0001-0001-000000000017', 'Grup 17 - Zeynep Okur', '#f43f5e', ['21','22','23','158','31','32'], 17),
        ('a1000001-0001-0001-0001-000000000018', 'Grup 18 - Oğuzhan Elmas', '#fb7185', ['24','25','34','35'], 18),
        ('a1000001-0001-0001-0001-000000000019', 'Grup 19 - İnanç Koçak', '#f472b6', ['26','27','40','41'], 19),
        ('a1000001-0001-0001-0001-000000000020', 'Grup 20 - Tuğba İlbay', '#e879f9', ['28','29','42','43'], 20),
        ('a1000001-0001-0001-0001-000000000021', 'Grup 21 - Sıla Kuvat', '#c084fc', ['30','162','44','163'], 21),
        ('a1000001-0001-0001-0001-000000000022', 'Grup 22 - Aziz & Caner', '#a78bfa', ['36','37','50','51'], 22),
        ('a1000001-0001-0001-0001-000000000023', 'Grup 23 - Yusuf & Mehmet K.', '#818cf8', ['38','39','52','53'], 23),
        ('a1000001-0001-0001-0001-000000000024', 'Grup 24 - Feray & Ezgi', '#6366f1', ['4','5','13','14','15'], 24),
        ('a1000001-0001-0001-0001-000000000025', 'Grup 25 - M.Ali Karasu', '#4f46e5', ['47','48','61','62'], 25),
        ('a1000001-0001-0001-0001-000000000026', 'Grup 26 - Hakan Cintosun', '#4338ca', ['49','63','64'], 26),
        ('a1000001-0001-0001-0001-000000000027', 'Grup 27 - Kaan Tonyalıoğlu', '#3730a3', ['54','65','66'], 27),
        ('a1000001-0001-0001-0001-000000000028', 'Grup 28 - Kazım Koca', '#312e81', ['55','56','67','68'], 28),
        ('a1000001-0001-0001-0001-000000000029', 'Grup 29 - Onur Nama', '#1e1b4b', ['57','58','69','70','164'], 29),
        ('a1000001-0001-0001-0001-000000000030', 'Grup 30 - Şevval Erol', '#0f172a', ['6','7','8','16','17','18'], 30),
        ('a1000001-0001-0001-0001-000000000031', 'Grup 31 - M. Akif Şimşek', '#0c4a6e', ['63','64','65','66'], 31),
        ('a1000001-0001-0001-0001-000000000032', 'Grup 32 - Kerem Ertürk', '#075985', ['71','72','86','87'], 32),
        ('a1000001-0001-0001-0001-000000000033', 'Grup 33 - Aytekin Sarıtoprak', '#0369a1', ['73','74','88','89'], 33),
        ('a1000001-0001-0001-0001-000000000034', 'Grup 34 - Barış Tüzün', '#0284c7', ['75','76','90','91'], 34),
        ('a1000001-0001-0001-0001-000000000035', 'Grup 35 - Ahmet Can & Ömer & M.Ali D.', '#0ea5e9', ['77','78','92','93'], 35),
        ('a1000001-0001-0001-0001-000000000036', 'Grup 36 - Ali Dönmez', '#38bdf8', ['79','80','94','95'], 36),
        ('a1000001-0001-0001-0001-000000000037', 'Grup 37 - Cafer Melih Yel', '#7dd3fc', ['81','82','96','97'], 37),
        ('a1000001-0001-0001-0001-000000000038', 'Grup 38 - Mehmet Yıldırım', '#bae6fd', ['83','84','85','98','99','100'], 38),
        ('a1000001-0001-0001-0001-000000000039', 'Grup 39 - Yıldız Ağırman', '#e0f2fe', ['9','10','19','20','161'], 39),
    ]
    
    for group_id, name, color, table_ids, sort_order in groups_data:
        cursor.execute('''
            INSERT INTO table_groups (id, "eventId", name, color, "tableIds", "groupType", "sortOrder", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, 'standard', %s, NOW(), NOW())
        ''', (group_id, EVENT_ID, name, color, table_ids, sort_order))
    
    print(f"✓ {len(groups_data)} masa grubu eklendi")
    
    # ==================== PERSONEL ATAMALARI ====================
    # Önce personel ID'lerini çek
    cursor.execute('''
        SELECT id, "fullName" FROM staff WHERE "isActive" = true
    ''')
    staff_map = {row[1]: str(row[0]) for row in cursor.fetchall()}
    
    # Personel atamaları listesi
    assignments = [
        # (staff_name, tableIds, shift_start, shift_end)
        ("Mahperi Kurt", ['1','2','3','11','12'], "20:00", "02:00"),
        ("Tuğçe Kirenli", ['101','116','117'], "17:00", "00:00"),
        ("SALiH  SEVIKA", ['101','116','117'], "20:00", "02:00"),
        ("Ramazan Nuryagdyyev", ['102','103','118','119'], "20:00", "00:00"),
        ("Özgür Özgün", ['104','105','120','121'], "16:00", "00:00"),
        ("Cihan Erdoğan", ['104','105','120','121'], "17:00", "00:00"),
        ("Yaşar Atamkoçyiğit", ['106','107','122','123'], "12:00", None),
        ("Ali Gezer", ['106','107','122','123'], "17:00", "00:00"),
        ("Furkan Yıldırım", ['108','109','124','125'], "12:00", None),
        ("Halit Bağış", ['108','109','124','125'], "17:00", "00:00"),
        ("Erencan Turan", ['110','111','126','127'], "20:00", "00:00"),
        ("Bilal Iqbal", ['110','111','126','127'], "17:00", "00:00"),
        ("Orhan Atlı", ['112','113','128','129'], "17:00", "00:00"),
        ("Eren Önder", ['114','115','130','131'], "20:00", "02:00"),
        ("Ramazan Doğanay", ['114','115','130','131'], "17:00", "00:00"),
        ("Nur Absal", ['132','133','147','148'], "17:00", "00:00"),
        ("Sefa Faruk Kurt", ['132','33','147','148'], "12:00", None),
        ("Mustafa Başkale", ['134','135','149','150'], "20:00", "02:00"),
        ("Sergen Elmas", ['134','135','149','150'], "17:00", "00:00"),
        ("Uğur Can Delibaş", ['136','137','151','152'], "20:00", "00:00"),
        ("Salman Ali", ['136','137','151','152'], "17:00", "00:00"),
        ("Emirhan Boyraz", ['138','139','140','141'], "16:00", "00:00"),
        ("Muhammed Abdullah", ['138','139','140','141'], "17:00", "00:00"),
        ("Bünyamin Aydın", ['142','143','153','154'], "16:00", None),
        ("Muhammed Wassem", ['142','143','153','154'], "17:00", "00:00"),
        ("Sibel Atasoy", ['144','145','146','155','156','157'], "16:00", None),
        ("Onurcan Koyun", ['144','145','146','155','156','157'], "16:00", None),
        ("Hüseyin Tülegen", ['144','145','146','155','156','157'], "17:00", "00:00"),
        ("Feryal Yaman", ['159','45','46','160','59','60'], "20:00", "00:00"),
        ("Zeynep Ebru Okur", ['21','22','23','158','31','32'], "19:00", "00:00"),
        ("Oğuzhan Elmas", ['24','25','33','34','35'], "16:00", None),
        ("İnanç Koçak", ['26','27','40','41'], "16:00", None),
        ("Tuğba İlbay", ['28','29','42','43'], "19:00", "00:00"),
        ("Sıla Kuvat", ['30','162','44','163'], "19:00", "00:00"),
        ("Aziz Demhat Yılmaz", ['36','37','50','51'], "12:00", None),
        ("Caner Özkan Kutlu", ['36','37','50','51'], "16:00", None),
        ("Yusuf Şahin", ['38','39','52','53'], "16:00", None),
        ("Mehmet Koçak", ['38','39','52','53'], "16:00", None),
        ("Feray Yakıcı", ['4','5','13','14','15'], "16:00", "00:00"),
        ("Ezgi Çağla Kaşıkçı", ['4','5','13','14','15'], "16:00", None),
        ("Mehmet Ali Karasu", ['47','48','61','62'], "19:00", None),
        ("Hakan Cintosun", ['49','63','64'], "20:00", "00:00"),
        ("Kaan Tonyalıoğlu", ['54','65','66'], "20:00", "00:00"),
        ("Kazım Koca", ['55','56','67','68'], "19:00", "00:00"),
        ("Onur Nama", ['57','58','69','70','164'], "20:00", "00:00"),
        ("Şevval Erol", ['6','7','8','16','17','18'], "16:00", "00:00"),
        ("Mehmet Akif Şimşek", ['63','64','65','66'], "16:00", None),
        ("Kerem Ertürk", ['71','72','86','87'], "19:00", None),
        ("Aytekin Sarıtoprak", ['73','74','88','89'], "19:00", None),
        ("Barış Tüzün", ['75','76','90','91'], "16:00", "00:00"),
        ("Ahmet Can Fındıcak", ['77','78','92','93'], "16:00", "00:00"),
        ("Ömer İnce", ['77','78','92','93'], "16:00", None),
        ("Mehmet Ali Deste", ['77','78','92','93'], "17:00", "00:00"),
        ("Ali Dönmez", ['79','80','94','95'], "16:00", None),
        ("Cafer Melih Yel", ['81','82','96','97'], "20:00", "00:00"),
        ("Mehmet Yıldırım", ['83','84','85','98','99','100'], "19:00", None),
        ("Yıldız Ağırman", ['9','10','19','20','161'], "20:00", "00:00"),
    ]
    
    inserted = 0
    not_found = []
    
    for idx, (name, tables, start, end) in enumerate(assignments):
        staff_id = staff_map.get(name)
        if not staff_id:
            not_found.append(name)
            continue
        
        assignment_id = f'b1000001-0001-0001-0001-{str(idx+1).zfill(12)}'
        cursor.execute('''
            INSERT INTO event_staff_assignments 
            (id, "eventId", "staffId", "tableIds", "assignmentType", 
             "specialTaskStartTime", "specialTaskEndTime", "sortOrder", "isActive", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, 'table', %s, %s, %s, true, NOW(), NOW())
        ''', (assignment_id, EVENT_ID, staff_id, tables, start, end, idx+1))
        inserted += 1
    
    conn.commit()
    
    print(f"✓ {inserted} personel ataması eklendi")
    if not_found:
        print(f"⚠ Bulunamayan personeller: {not_found}")
    
    # Sonuç
    cursor.execute('''
        SELECT COUNT(*) FROM table_groups WHERE "eventId" = %s
    ''', (EVENT_ID,))
    group_count = cursor.fetchone()[0]
    
    cursor.execute('''
        SELECT COUNT(*) FROM event_staff_assignments WHERE "eventId" = %s
    ''', (EVENT_ID,))
    assignment_count = cursor.fetchone()[0]
    
    print("\n" + "=" * 60)
    print(f"ÖZET: {group_count} grup, {assignment_count} atama")
    print("=" * 60)
    
    cursor.close()
    conn.close()
    print("✓ İşlem tamamlandı!")

if __name__ == "__main__":
    main()
