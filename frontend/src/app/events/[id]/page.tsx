'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useCanvasStore } from '@/store/canvas-store';
import { useSettingsStore } from '@/store/settings-store';
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar';
import { TablePanel } from '@/components/canvas/TablePanel';
import { ReservationPanel } from '@/components/canvas/ReservationPanel';
import { StaffAssignmentPanel } from '@/components/canvas/StaffAssignmentPanel';
import { ArrowLeft, Save, Eye, Users, UserPlus, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { TableInstance, Reservation, TableType } from '@/types';
import { eventsApi, venuesApi } from '@/lib/api';

// Canvas'ı client-side only olarak yükle (SSR devre dışı)
const EventCanvas = dynamic(
  () => import('@/components/canvas/EventCanvas').then((mod) => mod.EventCanvas),
  { ssr: false }
);

export default function EventPlannerPage() {
  const params = useParams();
  const eventId = params.id as string;
  
  const { setTableTypes, setLayout, selectedTableIds, toggleGrid } = useCanvasStore();
  const { tableTypes: dbTableTypes, fetchTableTypes, systemSettings, fetchSettings } = useSettingsStore();
  const [selectedTable, setSelectedTable] = useState<TableInstance | null>(null);
  const [showReservationPanel, setShowReservationPanel] = useState(false);
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [, setReservations] = useState<Reservation[]>([]);

  const [eventLoaded, setEventLoaded] = useState(false);

  // Veritabanından masa türlerini ve ayarları yükle
  useEffect(() => {
    fetchTableTypes();
    fetchSettings();
  }, [fetchTableTypes, fetchSettings]);

  // Kayıtlı etkinlik layout'unu yükle
  useEffect(() => {
    const loadEventLayout = async () => {
      try {
        const response = await eventsApi.getOne(eventId);
        const event = response.data;
        
        if (event?.venueLayout?.tables && event.venueLayout.tables.length > 0) {
          // Kayıtlı layout var - yükle
          const { tables, dimensions, stage, zones, walls } = event.venueLayout;
          
          const loadedTables: TableInstance[] = tables.map((t: any) => ({
            id: t.id,
            typeId: t.type || t.typeId,
            typeName: t.typeName,
            x: t.x,
            y: t.y,
            rotation: t.rotation || 0,
            capacity: t.capacity,
            color: t.color,
            shape: t.shape,
            label: t.label,
          }));
          
          setLayout({
            width: dimensions?.width || 1100,
            height: dimensions?.height || 700,
            tables: loadedTables,
            walls: walls || [],
            gridSize: dimensions?.gridSize || 20,
            stage: stage || undefined,
            zones: zones || [],
          });
          
          setEventLoaded(true);
          console.log('Kayıtlı layout yüklendi:', loadedTables.length, 'masa');
        }
      } catch (error) {
        console.log('Yeni etkinlik veya layout yok, varsayılan kullanılacak');
      }
    };
    
    if (eventId) {
      loadEventLayout();
    }
  }, [eventId, setLayout]);

  // Masa türleri yüklendiğinde canvas store'a aktar
  useEffect(() => {
    if (dbTableTypes.length > 0) {
      const canvasTableTypes: TableType[] = dbTableTypes.map((t) => ({
        id: t.id,
        name: t.name,
        capacity: t.capacity,
        color: t.color,
        shape: t.shape as 'round' | 'rectangle' | 'square',
      }));
      // Türkçe alfabetik sırala
      canvasTableTypes.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      setTableTypes(canvasTableTypes);
      
      // Not: pendingTableCounts sadece yeni etkinlik oluşturulduğunda doldurulur
      // Sayfa yenilendiğinde boş kalır - bu normal davranış
    }
  }, [dbTableTypes, setTableTypes]);

  // Varsayılan layout - Sahne (T şekli), System Kontrol, 12 Loca
  // Sadece kayıtlı layout yoksa yükle
  useEffect(() => {
    // Kayıtlı layout varsa varsayılanı yükleme
    if (eventLoaded) return;
    
    // Canvas boyutları - görseldeki orana uygun (geniş ve kısa)
    const canvasWidth = 1100;
    const canvasHeight = 700;
    
    // Ayarlardan grid boyutunu al (varsayılan 20)
    const gridSize = systemSettings?.defaultGridSize || 20;
    
    // Grid ayarını uygula
    if (systemSettings?.showGridByDefault === false) {
      toggleGrid(); // Grid'i kapat
    }
    
    // 12 Loca için default masalar - görseldeki gibi sıralı (9B, 9A, 8B, 8A, 7, 6, 5, 4, 3B, 3A, 2, 1)
    const locaTables: TableInstance[] = [];
    const locaLabels = ['L-9B', 'L-9A', 'L-8B', 'L-8A', 'L-7', 'L-6', 'L-5', 'L-4', 'L-3B', 'L-3A', 'L-2', 'L-1'];
    const locaCount = locaLabels.length;
    const locaAreaWidth = canvasWidth - 80; // Kenarlardan 40px boşluk
    const locaSpacing = locaAreaWidth / locaCount;
    const locaStartX = 40 + locaSpacing / 2;
    const locaY = canvasHeight - 35; // En altta

    locaLabels.forEach((label, i) => {
      locaTables.push({
        id: `loca-${label}`,
        typeId: 'loca',
        typeName: 'Loca',
        x: locaStartX + i * locaSpacing,
        y: locaY,
        rotation: 0,
        capacity: 6,
        color: '#93c5fd',
        shape: 'rectangle',
        label: label,
      });
    });

    // Sahne T şekli boyutları - görseldeki gibi küçük ve orantılı
    const stageTopWidth = 200;
    const stageTopHeight = 50;
    const stageExtWidth = 80;
    const stageExtHeight = 200;
    const stageEndWidth = 120;
    const stageEndHeight = 30;
    
    // Sahne merkez X
    const stageCenterX = canvasWidth / 2;
    const stageTopY = 30;

    setLayout({
      width: canvasWidth,
      height: canvasHeight,
      tables: locaTables,
      walls: [],
      gridSize: gridSize,
      stage: {
        x: stageCenterX - stageTopWidth / 2,
        y: stageTopY,
        width: stageTopWidth,
        height: stageTopHeight,
        label: 'SAHNE',
      },
      zones: [
        // Ana çerçeve - kırmızı border
        {
          id: 'main-frame',
          x: 20,
          y: 20,
          width: canvasWidth - 40,
          height: canvasHeight - 100,
          label: '',
          color: '#dc2626',
          type: 'frame',
        },
        // Sahne üst kısmı (geniş dikdörtgen) - T'nin üst çizgisi
        {
          id: 'stage-top',
          x: stageCenterX - stageTopWidth / 2,
          y: stageTopY,
          width: stageTopWidth,
          height: stageTopHeight,
          label: '',
          color: '#93c5fd',
          type: 'stage',
        },
        // Sahne bilgi kutusu (içeride)
        {
          id: 'stage-info',
          x: stageCenterX - stageTopWidth / 2 + 10,
          y: stageTopY + 5,
          width: stageTopWidth - 20,
          height: stageTopHeight - 10,
          label: 'Sahne',
          color: '#93c5fd',
          type: 'info',
        },
        // Sahne ön uzantısı (T'nin dikey kısmı)
        {
          id: 'stage-front',
          x: stageCenterX - stageExtWidth / 2,
          y: stageTopY + stageTopHeight,
          width: stageExtWidth,
          height: stageExtHeight,
          label: '',
          color: '#93c5fd',
          type: 'stage-extension',
        },
        // Sahne ön ucu (kırmızı çerçeveli dikdörtgen)
        {
          id: 'stage-front-end',
          x: stageCenterX - stageEndWidth / 2,
          y: stageTopY + stageTopHeight + stageExtHeight,
          width: stageEndWidth,
          height: stageEndHeight,
          label: '',
          color: '#dc2626',
          type: 'stage-end',
        },
        // System Kontrol - loca alanının hemen üstünde, alt duvara sıfır
        {
          id: 'system-kontrol',
          x: stageCenterX - 100,
          y: canvasHeight - 100 - 35, // Loca üstü, frame içinde
          width: 200,
          height: 35,
          label: 'EVENT FLOW SYSTEM',
          color: '#dc2626',
          type: 'system',
        },
        // Loca alanı çerçevesi - en altta
        {
          id: 'loca-area',
          x: 30,
          y: canvasHeight - 60,
          width: canvasWidth - 60,
          height: 70,
          label: 'LOCALAR',
          color: '#fecaca',
          type: 'loca',
        },
      ],
    });
  }, [setLayout, systemSettings, toggleGrid, eventLoaded]);

  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { tables, layout } = useCanvasStore.getState();
      
      // Toplam kapasite
      const totalCapacity = tables.reduce((sum, t) => sum + (t.capacity || 0), 0);
      
      // venueLayout formatı - backend entity'sine uygun
      const venueLayout = {
        tables: tables.map((t) => ({
          id: t.id,
          type: t.typeId,
          typeName: t.typeName,
          x: t.x,
          y: t.y,
          rotation: t.rotation || 0,
          capacity: t.capacity,
          color: t.color,
          shape: t.shape,
          label: t.label,
        })),
        walls: layout.walls || [],
        stage: layout.stage || null,
        zones: layout.zones || [],
        dimensions: {
          width: layout.width,
          height: layout.height,
          gridSize: layout.gridSize,
        },
      };
      
      // API'ye kaydet - DRAFT status
      await eventsApi.update(eventId, {
        venueLayout,
        totalCapacity,
        status: 'draft',
      });
      
      console.log('Taslak kaydedildi');
      alert('Taslak başarıyla kaydedildi!');
    } catch (error: unknown) {
      console.error('Kaydetme hatası:', error);
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 401) {
        alert('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      } else {
        alert('Kaydetme sırasında bir hata oluştu. Backend bağlantısını kontrol edin.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleApproveLayout = async () => {
    setSaving(true);
    try {
      const { tables, layout } = useCanvasStore.getState();
      
      // Loca hariç masa kontrolü
      const nonLocaTables = tables.filter(
        (t) => t.typeName?.toLowerCase() !== 'loca' && t.typeId !== 'loca'
      );
      
      if (nonLocaTables.length === 0) {
        alert('Lütfen en az bir masa ekleyin!');
        setSaving(false);
        return;
      }
      
      // Toplam kapasite
      const totalCapacity = tables.reduce((sum, t) => sum + (t.capacity || 0), 0);
      
      // venueLayout formatı - backend entity'sine uygun
      const venueLayout = {
        tables: tables.map((t) => ({
          id: t.id,
          type: t.typeId,
          typeName: t.typeName,
          x: t.x,
          y: t.y,
          rotation: t.rotation || 0,
          capacity: t.capacity,
          color: t.color,
          shape: t.shape,
          label: t.label,
        })),
        walls: layout.walls || [],
        stage: layout.stage || null,
        zones: layout.zones || [],
        dimensions: {
          width: layout.width,
          height: layout.height,
          gridSize: layout.gridSize,
        },
      };
      
      // API'ye kaydet - PUBLISHED status (onaylandı)
      await eventsApi.update(eventId, {
        venueLayout,
        totalCapacity,
        status: 'published',
      });
      
      console.log('Yerleşim onaylandı');
      alert(`Yerleşim planı onaylandı!\n\nToplam: ${nonLocaTables.length} masa, ${totalCapacity} kişilik kapasite`);
    } catch (error: unknown) {
      console.error('Onaylama hatası:', error);
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 401) {
        alert('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      } else {
        alert('Onaylama sırasında bir hata oluştu. Backend bağlantısını kontrol edin.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTableSelect = (table: TableInstance | null) => {
    setSelectedTable(table);
  };

  const handleReservationCreate = (reservation: Reservation) => {
    setReservations((prev) => [...prev, reservation]);
  };

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* Header - kompakt */}
      <header className="flex-shrink-0 border-b border-slate-800 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/events" className="p-1.5 bg-slate-800 rounded-lg">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Etkinlik Planlama</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedTableIds.length > 0 && (
              <button
                onClick={() => setShowStaffPanel(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 rounded-lg text-sm"
              >
                <UserPlus className="w-4 h-4" />
                Personel ({selectedTableIds.length})
              </button>
            )}
            
            {selectedTable && (
              <button
                onClick={() => setShowReservationPanel(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 rounded-lg text-sm"
              >
                <Users className="w-4 h-4" />
                Rezervasyon
              </button>
            )}

            <button 
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 rounded-lg text-sm"
            >
              <FolderOpen className="w-4 h-4" />
              Şablon Seç
            </button>
            <button 
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 rounded-lg text-sm"
            >
              <Eye className="w-4 h-4" />
              Önizleme
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 rounded-lg text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Taslak Kaydet'}
            </button>
            <button
              onClick={handleApproveLayout}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Onaylanıyor...' : 'Yerleşimi Onayla'}
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar - kompakt */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-slate-800 overflow-x-auto">
        <CanvasToolbar />
      </div>

      {/* Main Content - kalan alanı doldur */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Canvas Area - tam genişlik */}
        <div className="flex-1 overflow-hidden">
          <EventCanvas 
            eventId={eventId} 
            onTableSelect={handleTableSelect}
          />
        </div>

        {/* Right Panel - geniş, scroll */}
        <div className="w-72 flex-shrink-0 border-l border-slate-800 p-3 overflow-y-auto">
          <TablePanel />
          
          {selectedTable && (
            <div className="mt-2 p-2 bg-slate-700 rounded-lg">
              <h4 className="font-medium text-sm mb-1">{selectedTable.label}</h4>
              <p className="text-xs text-slate-400">
                {selectedTable.typeName} - {selectedTable.capacity} kişilik
              </p>
              <button
                onClick={() => setShowReservationPanel(true)}
                className="w-full mt-2 py-1.5 bg-green-600 rounded-lg text-xs"
              >
                Rezervasyon Oluştur
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showReservationPanel && (
        <ReservationPanel
          table={selectedTable}
          onClose={() => setShowReservationPanel(false)}
          onReservationCreate={handleReservationCreate}
        />
      )}

      {showStaffPanel && (
        <StaffAssignmentPanel
          onClose={() => setShowStaffPanel(false)}
        />
      )}

      {/* Önizleme Modal */}
      {showPreview && (
        <PreviewModal onClose={() => setShowPreview(false)} />
      )}

      {/* Şablon Seçme Modal */}
      {showTemplates && (
        <TemplateModal onClose={() => setShowTemplates(false)} />
      )}
    </div>
  );
}

// Önizleme Modal Bileşeni
function PreviewModal({ onClose }: { onClose: () => void }) {
  const { tables, layout } = useCanvasStore();
  
  // Masa türlerine göre grupla
  const tablesByType: Record<string, { count: number; capacity: number; color: string }> = {};
  tables.forEach((t) => {
    const typeName = t.typeName || 'Bilinmeyen';
    if (!tablesByType[typeName]) {
      tablesByType[typeName] = { count: 0, capacity: 0, color: t.color };
    }
    tablesByType[typeName].count++;
    tablesByType[typeName].capacity += t.capacity || 0;
  });
  
  // Loca hariç masalar
  const nonLocaTables = tables.filter(
    (t) => t.typeName?.toLowerCase() !== 'loca' && t.typeId !== 'loca'
  );
  
  const totalCapacity = tables.reduce((sum, t) => sum + (t.capacity || 0), 0);
  const locaCapacity = tables
    .filter((t) => t.typeName?.toLowerCase() === 'loca' || t.typeId === 'loca')
    .reduce((sum, t) => sum + (t.capacity || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold">Yerleşim Planı Önizleme</h2>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 rounded-lg text-slate-400"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Özet Bilgiler */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-700 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{nonLocaTables.length}</div>
              <div className="text-sm text-slate-400">Masa</div>
            </div>
            <div className="bg-slate-700 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{totalCapacity}</div>
              <div className="text-sm text-slate-400">Toplam Kapasite</div>
            </div>
            <div className="bg-slate-700 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-400">{locaCapacity}</div>
              <div className="text-sm text-slate-400">Loca Kapasitesi</div>
            </div>
          </div>
          
          {/* Masa Türleri Detayı */}
          <div className="bg-slate-700 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3">Masa Türleri</h3>
            <div className="space-y-2">
              {Object.entries(tablesByType).map(([typeName, data]) => (
                <div key={typeName} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: data.color }}
                    />
                    <span>{typeName}</span>
                  </div>
                  <div className="text-slate-400">
                    {data.count} adet - {data.capacity} kişi
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Mini Canvas Önizleme */}
          <div className="bg-slate-900 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Yerleşim Görünümü</h3>
            <div 
              className="relative mx-auto border border-slate-600 rounded"
              style={{ 
                width: Math.min(layout.width * 0.6, 600), 
                height: Math.min(layout.height * 0.6, 400),
                background: '#0f172a'
              }}
            >
              {/* Masaları göster */}
              {tables.map((table) => (
                <div
                  key={table.id}
                  className="absolute rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    left: `${(table.x / layout.width) * 100}%`,
                    top: `${(table.y / layout.height) * 100}%`,
                    width: table.typeName?.toLowerCase() === 'loca' ? 30 : 20,
                    height: table.typeName?.toLowerCase() === 'loca' ? 20 : 20,
                    backgroundColor: table.color,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: table.typeName?.toLowerCase() === 'loca' ? '4px' : '50%',
                  }}
                />
              ))}
              
              {/* Sahne */}
              {layout.stage && (
                <div
                  className="absolute bg-blue-300/50 flex items-center justify-center text-xs"
                  style={{
                    left: `${(layout.stage.x / layout.width) * 100}%`,
                    top: `${(layout.stage.y / layout.height) * 100}%`,
                    width: `${(layout.stage.width / layout.width) * 100}%`,
                    height: `${(layout.stage.height / layout.height) * 100}%`,
                  }}
                >
                  SAHNE
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 rounded-lg font-medium"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

// Şablon Seçme Modal Bileşeni
function TemplateModal({ onClose }: { onClose: () => void }) {
  const { setLayout, clearAllTables } = useCanvasStore();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Şablonları yükle
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await venuesApi.getAll();
        setTemplates(response.data || []);
      } catch (error) {
        console.error('Şablonlar yüklenemedi:', error);
        // Varsayılan şablonlar
        setTemplates([
          {
            id: 'default-club',
            name: 'Standart Gece Kulübü',
            description: 'T şekilli sahne, 12 loca, standart yerleşim',
            usageCount: 15,
          },
          {
            id: 'default-concert',
            name: 'Konser Salonu',
            description: 'Geniş sahne, ayakta alan, VIP bölümler',
            usageCount: 8,
          },
          {
            id: 'default-wedding',
            name: 'Düğün Salonu',
            description: 'Yuvarlak masalar, dans pisti, sahne',
            usageCount: 12,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, []);

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    const template = templates.find((t) => t.id === selectedTemplate);
    if (!template) return;

    // Mevcut masaları temizle (Localar hariç)
    clearAllTables();

    // Şablon verilerini uygula
    if (template.layoutData) {
      // Backend'den gelen şablon
      const { dimensions, stage, walls } = template.layoutData;
      
      setLayout({
        width: dimensions?.width || 1100,
        height: dimensions?.height || 700,
        tables: [],
        walls: walls || [],
        gridSize: 20,
        stage: stage || null,
        zones: [],
      });
    }

    alert(`"${template.name}" şablonu uygulandı!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold">Yerleşim Şablonu Seç</h2>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 rounded-lg text-slate-400"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Yükleniyor...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              Henüz kayıtlı şablon yok
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-600 bg-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{template.name}</h3>
                      <p className="text-sm text-slate-400 mt-1">
                        {template.description || 'Açıklama yok'}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">
                      {template.usageCount || 0} kullanım
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 rounded-lg"
          >
            İptal
          </button>
          <button
            onClick={handleApplyTemplate}
            disabled={!selectedTemplate}
            className="px-4 py-2 bg-blue-600 rounded-lg font-medium disabled:opacity-50"
          >
            Şablonu Uygula
          </button>
        </div>
      </div>
    </div>
  );
}
