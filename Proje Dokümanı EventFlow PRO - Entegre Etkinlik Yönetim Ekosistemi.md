# Proje Dokümanı: EventFlow PRO - Entegre Etkinlik Yönetim Ekosistemi

## 1. Proje Vizyonu ve Özeti

**EventFlow PRO**, etkinlik sektöründeki tüm paydaşların (Organizatör, Mekan Sahibi, Personel ve Misafir) ihtiyaçlarını tek bir **PWA (Progressive Web App)** üzerinde karşılayan SaaS tabanlı bir platformdur. Sistem; yapay zeka destekli yerleşim önerileri, görsel masa yönetimi, CRM tabanlı müşteri analizi, 3D görselleştirme ve QR tabanlı operasyonel süreçleri kapsar.

## 2. Teknoloji Mimarisi (Tech Stack)

Bu ölçekteki bir proje için performans, ölçeklenebilirlik ve SEO kritiktir.

### **Frontend (İstemci Taraflı)**

- **Core Framework:** **Next.js 14+ (React)** (Server Side Rendering ve SEO için şart).
- **2D Planlama:** **React-Konva** (Canvas API üzerinde yüksek performanslı çizim ve sürükle-bırak).
- **3D Görselleştirme:** **React-Three-Fiber (Three.js)** (Masa koordinatlarını 3D ortama döküp sahne bakış açısı simülasyonu için).
- **UI/UX:** **Tailwind CSS** + **Radix UI** (Erişilebilir ve modern bileşenler).
- **State Management:** **Zustand** (Karmaşık planlama verileri için) + **TanStack Query** (Sunucu veri yönetimi için).

### **Backend (Sunucu Taraflı)**

- 
- **Framework:** **NestJS** (Node.js tabanlı, modüler, kurumsal mimari).
- **Database:** **PostgreSQL** (Coğrafi veriler ve karmaşık ilişkiler için).
- **ORM:** **Prisma** (Tip güvenli veritabanı erişimi).
- **Real-time:** **Socket.io** (Canlı rezervasyon durumu ve check-in takibi).

------



## 3. Sistem Modülleri ve Detaylı İşleyiş

### 3.1. Yönetim Paneli ve Şablon Pazarı (Marketplace)

Sistemin kurulum ve paylaşım merkezidir.

- **Sistem Ayarları:**
  - Masa Türleri (VIP, Standart, Loca), Renk Kodları, Varsayılan Kapasiteler.
- **Şablon Pazarı (Marketplace):**
  - Kullanıcılar, sık kullandıkları masa yerleşim düzenlerini kaydedebiliri ilerideki farklı etkinliklerde kullanabilirler

### 3.2. Etkinlik Oluşturma ve Kapasite Mühendisliği

- **Veri Girişi:** Etkinlik Adı, Tarih, Saat, Mekan.

- **Matematiksel Planlama:**

  - Yönetici tablo halinde girer: "100 adet Standart (8 kişilik), 60 adet VIP (12 kişilik)".

  - Sistem toplam kişi kapasitesini  hesaplar.

    

### 3.3. Akıllı Görsel Yerleşim ve 3D Bakış (Core Feature)

React-Konva ve Three.js teknolojilerinin birleştiği merkezdir.

- **Oto-Yerleşim Algoritması:**
  - Sistem; VIP masaları sahne önüne, Premiumları ortaya, Standartları arkaya dizer.Loca lar  Admin tarafından yerleştirilir
  - Masalar arası minimum mesafe (koridor boşluğu) parametresi dikkate alınır.
- **Manuel Düzenleme (Canvas):**
  - Sürükle-bırak ile ince ayar.
  - Grid (Kılavuz) sistemi ve manyetik hizalama.
  - **Araçlar:** Silgi, Toplu Seçim, Döndürme.
- **3D "View from Seat" (Sahne Bakış Açısı):**
  - Yönetici veya müşteri bir masaya tıkladığında "3D Önizleme" butonuna basar.
  - Sistem, 2D plandaki koordinatları (X, Y, Açı) alır ve basit bir 3D model üzerinde kamerayı o masanın konumuna yerleştirir.
  - Sahnenin o masadan nasıl göründüğü (kör nokta var mı, kolon önünü kapatıyor mu) simüle edilir.

### 3.4. CRM ve Müşteri Sadakat Modülü (VIP Analizi)

Sistem, müşteriyi tanır ve yöneticiye istihbarat sağlar.

- **Müşteri Kartı:** İsim, Telefon, E-posta
- **Etkinlik Geçmişi:** Daha önce kaç etkinliğe geldi? 
- **Etiketleme (Tagging):** "Bahşiş Bırakır", "Sorun Çıkarır (Blacklist)", "Sahne Önü Sever", "Vegan".
- **Rezervasyon Sırasında Uyarı:** Yönetici bir ismi sisteme girdiğinde; *"Dikkat: Bu misafir geçen etkinlikte arka masadan şikayetçi olmuştu, ön masa öneriliyor."* uyarısı çıkar.

### 3.5. Rezervasyon Yönetimi ve QR Biletleme

- **Rezervasyon Girişi:** Masa seçimi -> Kişi Sayısı -> Müşteri Bilgisi.
- **Biletleme Motoru:**
  - Rezervasyon tamamlandığında sistem **Benzersiz (Unique) bir QR Kod** üretir.
  - Bu QR kod, müşteriye SMS veya E-posta (PDF Bilet) olarak gönderilir.
  - QR Kod içeriği şifrelidir (Etkinlik ID + Masa ID + Müşteri Hash).

### 3.6. Ekip Organizasyonu ve Performans Takibi

- **Görsel Atama:** Yerleşim planı üzerinde masalar seçilir, sağ tık ile "Garson Ahmet" atanır.
- **Renklendirme:** Her garsonun bir rengi vardır, atandığı masalar o renge bürünür.
- **Performans Takibi:**
  - Etkinlik sonunda raporlama: "Garson Ahmet 10 masaya baktı, toplam 40 misafir ağırladı."

### 3.7. Etkinlik Günü: Operasyon ve Kontrol (PWA Mobile)

Kapıdaki görevlilerin ve şef garsonların kullanacağı mobil arayüzdür.

- **QR Check-in (Turnike):**
  - Görevli tabletiyle müşterinin QR kodunu okutur.
  - **Anlık Tepki:** Ekranda "Onaylandı: Masa B-12 (VIP) - 4 Kişi" yazar.
  - **Yol Tarifi:** Kroki üzerinde masanın yeri yanıp sönerek gösterilir.
- **Canlı Dashboard:**
  - İçeride kaç kişi var?
  - Gelmesi beklenen kaç rezervasyon kaldı?
  - Boş masa sayısı nedir? (Kapıdan satış için).

------



## 4. Veritabanı Şeması (Database Schema - Özet)

Bu projeyi ayağa kaldırmak için gereken temel PostgreSQL tabloları:

codeSQL



```
-- MEKAN ŞABLONLARI (MARKETPLACE)
CREATE TABLE VenueTemplates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    layout_data JSONB, -- Duvarlar, sabit alanlar, sahne koordinatları
    is_public BOOLEAN DEFAULT false
);

-- ETKİNLİKLER
CREATE TABLE Events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    event_date TIMESTAMP,
    venue_layout JSONB, -- O etkinliğe özel masa koordinatları
    status ENUM('draft', 'published', 'active', 'completed')
);

-- MÜŞTERİLER (CRM)
CREATE TABLE Customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    vip_score INT DEFAULT 0,
    tags TEXT[], -- ['vegan', 'big_spender']
    is_blacklisted BOOLEAN DEFAULT false
);

-- REZERVASYONLAR VE BİLETLER
CREATE TABLE Reservations (
    id SERIAL PRIMARY KEY,
    event_id INT,
    table_id VARCHAR(50), -- Canvas üzerindeki masa ID'si
    customer_id INT,
    guest_count INT,
    qr_code_hash VARCHAR(255),
    check_in_status BOOLEAN DEFAULT false,
    check_in_time TIMESTAMP
);

-- EKİP VE PERFORMANS
CREATE TABLE StaffAssignments (
    id SERIAL PRIMARY KEY,
    event_id INT,
    staff_user_id INT,
    assigned_table_ids TEXT[] -- ['table-1', 'table-2']
);

CREATE TABLE StaffPerformanceLogs (
    id SERIAL PRIMARY KEY,
    staff_id INT,
    event_id INT,
    action_type VARCHAR(50), -- 'check_in', 'order_complete'
    response_time_seconds INT
);
```

------



## 5. Geliştirme Fazları (Roadmap)

Projeyi yönetilebilir parçalara bölüyoruz:

1. 
2. **Faz 1: Omurga (Backbone):** Admin paneli, etkinlik oluşturma ve temel veritabanı yapısı (Masa tipleri, kullanıcılar).
3. **Faz 2: Canvas Motoru (2D):** React-Konva entegrasyonu, masa çizimi, sürükle-bırak, otomatik yerleşim algoritması.
4. **Faz 3: Operasyonel Derinlik:** Ekip atama modülü (Multi-select, sağ tık menüsü) ve CRM altyapısı.
5. **Faz 4: 3D & Görsel Deneyim:** Masa koordinatlarının Three.js ile 3D önizlemeye dönüştürülmesi.
6. **Faz 5: Biletleme & Mobil Kontrol:** QR Kod üretim servisi ve kapı görevlisi için mobil PWA ekranları.
7. **Faz 6: Analitik & Marketplace:** Şablon kaydetme/yükleme ve performans raporlama ekranları.

------



## 6. Önemli UX/UI İpuçları

- **Dark Mode:** Etkinlik ortamları genelde karanlıktır. Uygulamanın "Dark Mode" olması, etkinlik sırasında tablet kullanan personelin gözünü almaması ve pil tasarrufu için şarttır.
- **Offline First:** İnternet kesilse bile kapıdaki görevli QR kodu okutup check-in yapabilmeli, internet geldiğinde sistem senkronize olmalıdır (PWA Service Workers).
- **Zoom/Pan:** Kroki planında "Pinch to Zoom" (Parmakla yakınlaştırma) mobil cihazlarda çok akıcı çalışmalıdır.