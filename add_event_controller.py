import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='eventflow',
    user='postgres',
    password='518518Erkan'
)

cur = conn.cursor()

# Bcrypt hash for '123456'
password_hash = '$2b$10$.wkD2UTu7soh1k4O5f5MLOzCPpE30pV2S2afjFLEdRlr0qr/v3foe'

cur.execute("""
    INSERT INTO users (id, username, password, "fullName", role, "isActive", "createdAt", "updatedAt")
    VALUES (
        gen_random_uuid(),
        'event',
        %s,
        'Event Controler',
        'controller',
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (username) DO UPDATE SET
        password = EXCLUDED.password,
        "fullName" = EXCLUDED."fullName",
        role = EXCLUDED.role
    RETURNING id, username, "fullName", role
""", (password_hash,))

result = cur.fetchone()
conn.commit()
print(f"User created/updated: {result}")
conn.close()
