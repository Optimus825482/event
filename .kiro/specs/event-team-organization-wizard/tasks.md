# Etkinlik Ekip Organizasyonu - Implementation Tasks

## 📋 Task Listesi

---

## Phase 1: Foundation (Temel Yapı)

### Task 1.1: Dosya Yapısını Oluştur

- [ ] `components/index.ts` barrel export dosyası
- [ ] `utils/index.ts` utility exports
- [ ] `utils/canvas-helpers.ts` canvas yardımcı fonksiyonları
- [ ] `utils/validation.ts` step validation fonksiyonları

**Dosyalar:**

- `frontend/src/app/(events)/events/[id]/team-organization/components/index.ts`
- `frontend/src/app/(events)/events/[id]/team-organization/utils/index.ts`
- `frontend/src/app/(events)/events/[id]/team-organization/utils/canvas-helpers.ts`
- `frontend/src/app/(events)/events/[id]/team-organization/utils/validation.ts`

---

### Task 1.2: useCanvasInteraction Hook

Canvas mouse/touch işlemleri için hook:

- [ ] Zoom state ve handlers
- [ ] Pan state ve handlers
- [ ] Lasso selection state ve handlers
- [ ] Keyboard shortcuts (Ctrl+A, Escape)

**Dosya:** `frontend/src/app/(events)/events/[id]/team-organization/hooks/useCanvasInteraction.ts`

---

### Task 1.3: CanvasRenderer Component

Ortak canvas render component:

- [ ] TableItem memoized component
- [ ] LocaItem memoized component
- [ ] Lasso selection overlay
- [ ] Zoom/Pan controls
- [ ] Grid background (optional)

**Dosya:** `frontend/src/app/(events)/events/[id]/team-organization/components/CanvasRenderer.tsx`

---

### Task 1.4: WizardNavigation Component

İleri/Geri navigasyon:

- [ ] Geri butonu (disabled on step 1)
- [ ] İleri butonu (validation check)
- [ ] Kaydet butonu (step 5)
- [ ] Keyboard navigation

**Dosya:** `frontend/src/app/(events)/events/[id]/team-organization/components/WizardNavigation.tsx`

---

### Task 1.5: Shared Card Components

- [ ] GroupCard component
- [ ] TeamDefinitionCard component
- [ ] StaffCard component

**Dosyalar:**

- `frontend/src/app/(events)/events/[id]/team-organization/components/GroupCard.tsx`
- `frontend/src/app/(events)/events/[id]/team-organization/components/TeamDefinitionCard.tsx`
- `frontend/src/app/(events)/events/[id]/team-organization/components/StaffCard.tsx`

---

## Phase 2: Step Components

### Task 2.1: Step1TableGrouping (Refactor)

Mevcut component'i refactor et:

- [ ] CanvasRenderer kullan
- [ ] useCanvasInteraction hook kullan
- [ ] GroupCard component kullan
- [ ] Otomatik grup ismi önerisi
- [ ] Grup düzenleme modal

**Dosya:** `frontend/src/app/(events)/events/[id]/team-organization/components/Step1TableGrouping.tsx`

---

### Task 2.2: Step2TeamDefinition

Takım tanımlama step'i:

- [ ] Takım listesi görünümü
- [ ] Yeni takım oluşturma formu
- [ ] Rol gereksinimleri ekleme
- [ ] Takım düzenleme/silme
- [ ] Renk seçici

**Dosya:** `frontend/src/app/(events)/events/[id]/team-organization/components/Step2TeamDefinition.tsx`

---

### Task 2.3: Step3GroupAssignment

Grup-Takım eşleştirme:

- [ ] İki panel layout (atanmamış / takımlar)
- [ ] Drag & Drop desteği
- [ ] Drop zone highlight
- [ ] Atama geri alma
- [ ] Görsel feedback

**Dosya:** `frontend/src/app/(events)/events/[id]/team-organization/components/Step3GroupAssignment.tsx`

---

### Task 2.4: Step4StaffAssignment

Personel atama:

- [ ] Personel havuzu (filtrelenebilir)
- [ ] Takım bazlı atama paneli
- [ ] Drag & Drop desteği
- [ ] Vardiya seçimi
- [ ] Görev rolü atama
- [ ] İlerleme göstergesi (X/Y atandı)

**Dosya:** `frontend/src/app/(events)/events/[id]/team-organization/components/Step4StaffAssignment.tsx`

---

### Task 2.5: Step5Summary

Özet ve kaydet:

- [ ] İstatistik kartları
- [ ] Uyarı listesi
- [ ] Takım breakdown accordion
- [ ] Export butonları (PDF, Excel)
- [ ] Şablon kaydet modal
- [ ] Kaydet butonu

**Dosya:** `frontend/src/app/(events)/events/[id]/team-organization/components/Step5Summary.tsx`

---

## Phase 3: Integration

### Task 3.1: Page.tsx Güncelle

Ana sayfa entegrasyonu:

- [ ] Yeni wizard yapısını entegre et
- [ ] Header component
- [ ] Loading state
- [ ] Error boundary
- [ ] Eski EventAssignmentTab'ı kaldır

**Dosya:** `frontend/src/app/(events)/events/[id]/team-organization/page.tsx`

---

### Task 3.2: API Entegrasyonu Test

- [ ] Grup kaydetme/yükleme
- [ ] Takım kaydetme/yükleme
- [ ] Personel atama kaydetme/yükleme
- [ ] Şablon kaydetme/yükleme
- [ ] Error handling

---

### Task 3.3: State Persistence

- [ ] localStorage ile draft kaydetme
- [ ] Sayfa yenilemede state koruma
- [ ] Unsaved changes uyarısı

---

### Task 3.4: Error Handling

- [ ] API error handling
- [ ] Validation error display
- [ ] Toast notifications
- [ ] Retry logic

---

## Phase 4: Polish

### Task 4.1: Animations & Transitions

- [ ] Step geçiş animasyonları
- [ ] Drag & Drop animasyonları
- [ ] Card hover effects
- [ ] Loading skeletons

---

### Task 4.2: Keyboard Navigation

- [ ] Tab navigation
- [ ] Enter = İleri
- [ ] Escape = Geri / İptal
- [ ] Ctrl+S = Kaydet
- [ ] Ctrl+A = Tümünü seç (canvas)

---

### Task 4.3: Responsive Design

- [ ] Desktop layout (>1024px)
- [ ] Tablet layout (768-1024px)
- [ ] Mobile layout (<768px)
- [ ] Touch gestures

---

### Task 4.4: Performance Optimization

- [ ] React.memo tüm card components
- [ ] useMemo expensive calculations
- [ ] useCallback handlers
- [ ] Virtual scrolling (uzun listeler)
- [ ] Lazy loading (step components)

---

## 🎯 Öncelik Sırası

1. **Kritik (Hemen):**

   - Task 1.1, 1.2, 1.3, 1.4
   - Task 2.1, 2.2, 2.3, 2.4, 2.5
   - Task 3.1

2. **Önemli (Sonra):**

   - Task 1.5
   - Task 3.2, 3.3, 3.4

3. **Nice-to-have (En son):**
   - Task 4.1, 4.2, 4.3, 4.4

---

## ✅ Tamamlanan Tasklar

- [x] requirements.md oluşturuldu
- [x] design.md oluşturuldu
- [x] tasks.md oluşturuldu
- [x] types.ts mevcut (güncelleme gerekebilir)
- [x] useWizardState.ts mevcut
- [x] useOrganizationData.ts mevcut
- [x] useCanvasInteraction.ts oluşturuldu
- [x] WizardStepper.tsx mevcut
- [x] WizardNavigation.tsx oluşturuldu
- [x] CanvasRenderer.tsx oluşturuldu
- [x] GroupCard.tsx oluşturuldu
- [x] Step1TableGrouping.tsx refactor edildi
- [x] Step2TeamDefinition.tsx oluşturuldu
- [x] Step3GroupAssignment.tsx oluşturuldu
- [x] Step4StaffAssignment.tsx oluşturuldu
- [x] Step5Summary.tsx oluşturuldu (Accordion → Custom Collapsible fix)
- [x] components/index.ts barrel export
- [x] hooks/index.ts barrel export
- [x] utils/index.ts barrel export
- [x] utils/canvas-helpers.ts oluşturuldu
- [x] utils/validation.ts oluşturuldu
- [x] page.tsx yeni wizard yapısıyla güncellendi
