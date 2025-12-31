import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='eventflow',
    user='postgres',
    password='518518Erkan'
)
cur = conn.cursor()

staff_list = [
    ('9aaf1dd7-8554-4d73-b932-84481a2c447e', '137773', 'YUSUF KOÇAK', 'yusuf.kocak@eventflow.com', 'Kaptan', '#f59e0b'),
    ('05527ac0-bd75-40ed-87d4-e49adabb2d8c', '137774', 'SABRİ ÖLMEZ', 'sabri.olmez@eventflow.com', 'Süpervizör', '#ef4444'),
    ('c5098692-8991-4ad7-919e-b0e3e7ac22e3', '137775', 'TUNCAY AÇAN', 'tuncay.acan@eventflow.com', 'Kaptan', '#f59e0b'),
    ('80cec34d-9906-4415-abf6-968775cbef67', '137776', 'HÜSEYİN YÜKSEL', 'huseyin.yuksel@eventflow.com', 'Kaptan', '#f59e0b'),
    ('ab12294c-5ede-4f36-966c-7f5fcd033ecd', '137777', 'EMRAH GÜNDOĞDU', 'emrah.gundogdu@eventflow.com', 'Kaptan', '#f59e0b'),
    ('f3cfffcb-81b5-4383-8b6b-6fec451bf7f3', '137778', 'ALİ EMRAH BERK', 'ali.emrah.berk@eventflow.com', 'Kaptan', '#22c55e'),
]

for staff in staff_list:
    cur.execute("""
        INSERT INTO staff (id, "sicilNo", "fullName", email, position, department, "isActive", color, "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, %s, 'Servis', true, %s, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
    """, staff)
    print(f"✅ {staff[2]} - {staff[4]}")

conn.commit()
print(f"\n✅ {len(staff_list)} personel local DB'ye eklendi")
conn.close()
