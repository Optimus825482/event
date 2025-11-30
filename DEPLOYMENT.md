# EventFlow PRO - Coolify Deployment Rehberi

## 🚀 Hızlı Kurulum

### 1. GitHub'a Push

```bash
git add .
git commit -m "Production ready for Coolify deployment"
git push origin main
```

### 2. Coolify'da Yeni Proje Oluştur

1. Coolify paneline giriş yap
2. **Projects** > **Add New**
3. **Docker Compose** seç
4. GitHub repo'nu bağla

### 3. Environment Variables Ayarla

Coolify panelinde şu değişkenleri tanımla:

```env
# Zorunlu
DB_USERNAME=postgres
DB_PASSWORD=guclu-sifre-buraya
DB_NAME=eventflow
JWT_SECRET=en-az-32-karakter-gizli-anahtar
DOMAIN=eventflow.senin-domain.com

# Opsiyonel (Mail için)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@gmail.com
SMTP_PASS=app-password
SMTP_FROM=EventFlow <noreply@domain.com>
```

### 4. Domain Ayarları

Coolify'da iki subdomain tanımla:

- `eventflow.domain.com` → Frontend (port 3000)
- `api.eventflow.domain.com` → Backend (port 4000)

### 5. Deploy

**Deploy** butonuna tıkla ve bekle!

---

## 📁 Dosya Yapısı

```
eventflow/
├── backend/           # NestJS API
├── frontend/          # Next.js App
├── docker-compose.yml # Local development
├── docker-compose.coolify.yml # Production
└── .env.example       # Örnek env dosyası
```

## 🔧 Önemli Notlar

### Database Migration

İlk deploy'da database tabloları otomatik oluşturulur (`synchronize: true`).

### Uploads

Upload edilen dosyalar `/app/uploads` volume'unda saklanır.

### SSL

Coolify otomatik Let's Encrypt SSL sertifikası sağlar.

---

## 🐛 Sorun Giderme

### Container loglarını kontrol et:

```bash
docker logs eventflow-backend
docker logs eventflow-frontend
```

### Database'e bağlan:

```bash
docker exec -it eventflow-db psql -U postgres -d eventflow
```

### Restart:

```bash
docker-compose restart backend
```
