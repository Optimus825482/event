# Etkinlik Ekip Organizasyonu - 5-Step Wizard

## 📋 Genel Bakış

Etkinlik için ekip organizasyonunu 5 adımlı wizard ile yönetme sistemi. Mevcut monolitik `EventAssignmentTab` (5310 satır) yerine modüler, bakımı kolay bir yapı.

## 🎯 Hedefler

1. **Modülerlik**: Her step ayrı component (~200-400 satır max)
2. **Performans**: React.memo, useMemo, useCallback optimizasyonları
3. **UX**: Akıcı wizard deneyimi, her adımda ilerleme göstergesi
4. **Bakım**: Single Responsibility Principle, test edilebilir yapı

## 📊 5-Step Wizard Akışı

```
Step 1: Masa Gruplandırma (Canvas üzerinde hızlı lasso seçim)
    ↓
Step 2: Takım Tanımlama (Kaç kişi, hangi görevler)
    ↓
Step 3: Masa Gruplarını Takımlara Atama (Drag & Drop)
    ↓
Step 4: Personel Atama (Takımlara personel ekleme)
    ↓
Step 5: Özet & Kaydet (Review ve onay)
```

## 🔧 Fonksiyonel Gereksinimler

### FR-001: Step 1 - Masa Gruplandırma

- [ ] Canvas üzerinde masaları görüntüleme (venue layout'tan)
- [ ] Lasso seçim ile çoklu masa seçimi
- [ ] Seçili masalardan grup oluşturma
- [ ] Grup rengi ve ismi belirleme
- [ ] Otomatik grup ismi önerisi (masa numaralarından)
- [ ] Grup düzenleme ve silme
- [ ] Zoom in/out, pan desteği

### FR-002: Step 2 - Takım Tanımlama

- [ ] Yeni takım oluşturma (isim, renk)
- [ ] Takım için gerekli personel sayısı belirleme
- [ ] Görev rolleri tanımlama (Garson, Komi, Barmen vb.)
- [ ] Her rol için kaç kişi gerektiğini belirleme
- [ ] Mevcut takımları listeleme ve düzenleme
- [ ] Takım silme

### FR-003: Step 3 - Grup-Takım Eşleştirme

- [ ] Sol panel: Atanmamış masa grupları
- [ ] Sağ panel: Takımlar ve atanmış grupları
- [ ] Drag & Drop ile grup-takım eşleştirme
- [ ] Bir grubun sadece bir takıma atanabilmesi
- [ ] Atama geri alma
- [ ] Görsel feedback (renk eşleştirme)

### FR-004: Step 4 - Personel Atama

- [ ] Takım bazlı personel listesi
- [ ] Pozisyona göre filtreleme
- [ ] Arama fonksiyonu
- [ ] Drag & Drop ile personel-takım eşleştirme
- [ ] Vardiya seçimi (shift)
- [ ] Görev rolü atama
- [ ] Atanmış personel sayısı / gerekli sayı gösterimi

### FR-005: Step 5 - Özet & Kaydet

- [ ] Tüm atamaların özet görünümü
- [ ] Takım bazlı breakdown
- [ ] Eksik atama uyarıları
- [ ] Kaydet butonu
- [ ] Şablon olarak kaydet seçeneği
- [ ] PDF/Excel export

## 🏗️ Teknik Gereksinimler

### TR-001: Dosya Yapısı

```
frontend/src/app/(events)/events/[id]/team-organization/
├── page.tsx                    # Ana sayfa (wizard container)
├── types.ts                    # Tip tanımlamaları ✅ (mevcut)
├── components/
│   ├── index.ts               # Barrel exports
│   ├── WizardStepper.tsx      # Step göstergesi ✅ (mevcut)
│   ├── WizardNavigation.tsx   # İleri/Geri butonları
│   ├── Step1TableGrouping.tsx # Masa gruplandırma
│   ├── Step2TeamDefinition.tsx # Takım tanımlama
│   ├── Step3GroupAssignment.tsx # Grup-Takım eşleştirme
│   ├── Step4StaffAssignment.tsx # Personel atama
│   ├── Step5Summary.tsx       # Özet ve kaydet
│   ├── CanvasRenderer.tsx     # Ortak canvas component
│   ├── GroupCard.tsx          # Grup kartı
│   ├── TeamCard.tsx           # Takım kartı
│   └── StaffCard.tsx          # Personel kartı
├── hooks/
│   ├── useWizardState.ts      # Wizard state yönetimi ✅ (mevcut)
│   ├── useOrganizationData.ts # API veri yönetimi ✅ (mevcut)
│   ├── useCanvasInteraction.ts # Canvas mouse/touch işlemleri
│   └── useDragAndDrop.ts      # Drag & Drop logic
└── utils/
    ├── index.ts               # Utility fonksiyonlar
    └── canvas-helpers.ts      # Canvas hesaplamaları
```

### TR-002: State Yönetimi

- Wizard state: `useWizardState` hook (mevcut, güncelleme gerekebilir)
- API data: `useOrganizationData` hook (mevcut)
- Canvas state: Yeni `useCanvasInteraction` hook
- Drag & Drop: Yeni `useDragAndDrop` hook

### TR-003: Performans Hedefleri

- Initial load: < 500ms
- Step geçişi: < 100ms
- Canvas render: 60 FPS
- Bundle size artışı: < 50KB

### TR-004: API Entegrasyonu

Mevcut API'ler kullanılacak:

- `staffApi.getEventTableGroups(eventId)`
- `staffApi.saveEventTableGroups(eventId, groups)`
- `staffApi.getTeams()`
- `staffApi.getPersonnel()`
- `staffApi.getEventStaffAssignments(eventId)`
- `staffApi.saveEventStaffAssignments(eventId, assignments)`

## 📱 UI/UX Gereksinimleri

### UX-001: Wizard Header

- Etkinlik adı ve tarihi
- 5 step göstergesi (tıklanabilir, tamamlanan step'ler yeşil)
- İlerleme çubuğu

### UX-002: Step Navigation

- "Geri" ve "İleri" butonları
- Step validation (gerekli alanlar doldurulmadan ilerleme engeli)
- Keyboard navigation (Enter = İleri, Escape = Geri)

### UX-003: Responsive Design

- Desktop: Yan yana paneller
- Tablet: Üst-alt paneller
- Mobile: Tek panel, tab geçişi

## 🔄 Migration Planı

1. Yeni wizard yapısını oluştur (mevcut yapıyı bozmadan)
2. Test et ve doğrula
3. `page.tsx`'i yeni wizard'a yönlendir
4. Eski `EventAssignmentTab`'ı archive'a taşı
5. Temizlik ve optimizasyon

## ✅ Kabul Kriterleri

- [ ] 5 step sorunsuz çalışıyor
- [ ] Tüm CRUD işlemleri çalışıyor
- [ ] Canvas performansı 60 FPS
- [ ] TypeScript hatasız
- [ ] Mevcut veriler korunuyor
- [ ] Responsive tasarım
