import psycopg2

EVENT_ID = "4d9fb75e-dbcb-4b26-9823-28ecac3e421b"

# Local DB'den grupları al
local_conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='eventflow',
    user='postgres',
    password='518518Erkan'
)
local_cur = local_conn.cursor()

local_cur.execute("""
    SELECT id, "eventId", name, color, "tableIds", "groupType", "sortOrder", "createdAt", "updatedAt"
    FROM table_groups 
    WHERE "eventId" = %s
    ORDER BY "sortOrder"
""", (EVENT_ID,))

groups = local_cur.fetchall()
print(f"Local'den {len(groups)} grup alındı")

# Grupları yazdır
for g in groups:
    print(f"  - {g[2]}: {g[4]}")

local_cur.close()
local_conn.close()
