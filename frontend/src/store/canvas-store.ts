import { create } from 'zustand';
import { TableInstance, CanvasTable, VenueLayout, TableType, StaffAssignment, Wall, Stage } from '@/types';

// History için snapshot tipi
interface CanvasSnapshot {
  tables: CanvasTable[];
  walls: Wall[];
  layout: VenueLayout;
}

interface CanvasState {
  // History (Undo/Redo)
  history: CanvasSnapshot[];
  historyIndex: number;
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Layout
  layout: VenueLayout;
  setLayout: (layout: VenueLayout) => void;
  
  // Tables
  tables: CanvasTable[];
  setTables: (tables: CanvasTable[]) => void;
  addTable: (table: CanvasTable) => void;
  updateTable: (id: string, updates: Partial<CanvasTable>) => void;
  removeTable: (id: string) => void;
  
  // Selection
  selectedTableIds: string[];
  setSelectedTableIds: (ids: string[]) => void;
  setSelectedTables: (ids: string[]) => void; // Alias
  toggleTableSelection: (id: string) => void;
  clearSelection: () => void;
  hoveredTableId: string | null;
  setHoveredTable: (id: string | null) => void;
  
  // Table Types
  tableTypes: TableType[];
  setTableTypes: (types: TableType[]) => void;
  
  // Staff Assignments
  staffAssignments: StaffAssignment[];
  setStaffAssignments: (assignments: StaffAssignment[]) => void;
  
  // Stage (Sahne)
  stageSelected: boolean;
  setStageSelected: (selected: boolean) => void;
  updateStage: (updates: Partial<Stage>) => void;
  deleteStage: () => void;
  createStageFromWall: (wallId: string) => void;
  
  // Wall labels (Çizgi etiketleri)
  selectedWallId: string | null;
  setSelectedWallId: (id: string | null) => void;
  setWallLabel: (wallId: string, label: string) => void;
  
  // Walls (Çizgiler/Duvarlar)
  walls: Wall[];
  addWall: (wall: Wall) => void;
  updateWall: (id: string, updates: Partial<Wall>) => void;
  removeWall: (id: string) => void;
  
  // Drawing state
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;
  currentDrawingPoints: number[];
  setCurrentDrawingPoints: (points: number[]) => void;
  
  // Canvas settings
  zoom: number;
  setZoom: (zoom: number) => void;
  gridEnabled: boolean;
  toggleGrid: () => void;
  snapToGrid: boolean;
  toggleSnap: () => void;
  
  // Tool
  activeTool: 'select' | 'pan' | 'draw' | 'eraser';
  setActiveTool: (tool: 'select' | 'pan' | 'draw' | 'eraser') => void;
  
  // Auto arrange
  autoArrangeTables: () => void;
  
  // Pending table counts (etkinlik oluşturmadan gelen)
  pendingTableCounts: Record<string, number>;
  setPendingTableCounts: (counts: Record<string, number>) => void;
  placeAllPendingTables: () => void;
  clearAllTables: () => void;
}

const defaultLayout: VenueLayout = {
  width: 1200,
  height: 800,
  tables: [],
  walls: [],
  gridSize: 20,
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // History
  history: [],
  historyIndex: -1,
  saveToHistory: () => set((state) => {
    const snapshot: CanvasSnapshot = {
      tables: JSON.parse(JSON.stringify(state.tables)),
      walls: JSON.parse(JSON.stringify(state.walls)),
      layout: JSON.parse(JSON.stringify(state.layout)),
    };
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(snapshot);
    // Max 50 history
    if (newHistory.length > 50) newHistory.shift();
    return { history: newHistory, historyIndex: newHistory.length - 1 };
  }),
  undo: () => set((state) => {
    if (state.historyIndex <= 0) return state;
    const newIndex = state.historyIndex - 1;
    const snapshot = state.history[newIndex];
    return {
      historyIndex: newIndex,
      tables: snapshot.tables,
      walls: snapshot.walls,
      layout: snapshot.layout,
    };
  }),
  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state;
    const newIndex = state.historyIndex + 1;
    const snapshot = state.history[newIndex];
    return {
      historyIndex: newIndex,
      tables: snapshot.tables,
      walls: snapshot.walls,
      layout: snapshot.layout,
    };
  }),
  canUndo: () => get().history.length > 0 && get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  layout: defaultLayout,
  setLayout: (layout) => {
    // İlk layout ayarlandığında history'ye kaydet
    const state = get();
    if (state.history.length === 0) {
      const snapshot: CanvasSnapshot = {
        tables: layout.tables as CanvasTable[],
        walls: layout.walls || [],
        layout: JSON.parse(JSON.stringify(layout)),
      };
      set({ 
        layout, 
        tables: layout.tables as CanvasTable[],
        history: [snapshot],
        historyIndex: 0,
      });
    } else {
      set({ layout, tables: layout.tables as CanvasTable[] });
    }
  },
  
  tables: [],
  setTables: (tables) => set({ tables }),
  addTable: (table) => {
    get().saveToHistory();
    set((state) => ({ tables: [...state.tables, table] }));
  },
  updateTable: (id, updates) => set((state) => ({
    tables: state.tables.map((t) => t.id === id ? { ...t, ...updates } : t),
  })),
  removeTable: (id) => {
    get().saveToHistory();
    set((state) => ({
      tables: state.tables.filter((t) => t.id !== id),
      selectedTableIds: state.selectedTableIds.filter((tid) => tid !== id),
    }));
  },
  
  selectedTableIds: [],
  setSelectedTableIds: (ids) => set({ selectedTableIds: ids }),
  setSelectedTables: (ids) => set({ selectedTableIds: ids }), // Alias
  toggleTableSelection: (id) => set((state) => ({
    selectedTableIds: state.selectedTableIds.includes(id)
      ? state.selectedTableIds.filter((tid) => tid !== id)
      : [...state.selectedTableIds, id],
  })),
  clearSelection: () => set({ selectedTableIds: [] }),
  hoveredTableId: null,
  setHoveredTable: (id) => set({ hoveredTableId: id }),
  
  tableTypes: [],
  setTableTypes: (types) => set({ tableTypes: types }),
  
  staffAssignments: [],
  setStaffAssignments: (assignments) => set({ staffAssignments: assignments }),
  
  zoom: 1,
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),
  gridEnabled: true,
  toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
  snapToGrid: true,
  toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),
  
  // Stage (Sahne)
  stageSelected: false,
  setStageSelected: (selected) => set({ stageSelected: selected }),
  updateStage: (updates) => set((state) => ({
    layout: {
      ...state.layout,
      stage: state.layout.stage ? { ...state.layout.stage, ...updates } : undefined,
    },
  })),
  deleteStage: () => set((state) => ({
    layout: { ...state.layout, stage: undefined },
    stageSelected: false,
  })),
  createStageFromWall: (wallId) => set((state) => {
    const wall = state.walls.find((w) => w.id === wallId);
    if (!wall) return state;
    
    // Çizginin bounding box'ını hesapla
    const xs = wall.points.filter((_, i) => i % 2 === 0);
    const ys = wall.points.filter((_, i) => i % 2 === 1);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      layout: {
        ...state.layout,
        stage: {
          x: minX,
          y: minY,
          width: Math.max(maxX - minX, 100),
          height: Math.max(maxY - minY, 50),
          label: 'SAHNE',
        },
      },
      walls: state.walls.filter((w) => w.id !== wallId),
    };
  }),
  
  // Wall labels
  selectedWallId: null,
  setSelectedWallId: (id) => set({ selectedWallId: id }),
  setWallLabel: (wallId, label) => set((state) => ({
    walls: state.walls.map((w) => w.id === wallId ? { ...w, label } : w),
  })),
  
  // Walls (Çizgiler)
  walls: [],
  addWall: (wall) => set((state) => ({ walls: [...state.walls, wall] })),
  updateWall: (id, updates) => set((state) => ({
    walls: state.walls.map((w) => w.id === id ? { ...w, ...updates } : w),
  })),
  removeWall: (id) => set((state) => ({
    walls: state.walls.filter((w) => w.id !== id),
  })),
  
  // Drawing state
  isDrawing: false,
  setIsDrawing: (drawing) => set({ isDrawing: drawing }),
  currentDrawingPoints: [],
  setCurrentDrawingPoints: (points) => set({ currentDrawingPoints: points }),
  
  // Auto arrange - masaları otomatik yerleştir
  autoArrangeTables: () => set((state) => {
    if (state.tables.length === 0) return state;
    
    const { layout } = state;
    const gridSize = layout.gridSize;
    const padding = 100; // Kenarlardan boşluk
    const spacing = 80; // Masalar arası minimum boşluk
    
    // Sahne varsa onun altından başla
    const startY = layout.stage 
      ? layout.stage.y + layout.stage.height + spacing 
      : padding;
    
    // Kullanılabilir alan
    const availableWidth = layout.width - (padding * 2);
    const availableHeight = layout.height - startY - padding;
    
    // Masaları türlerine göre grupla
    const tablesByType: Record<string, typeof state.tables> = {};
    state.tables.forEach((table) => {
      if (!tablesByType[table.typeId]) {
        tablesByType[table.typeId] = [];
      }
      tablesByType[table.typeId].push(table);
    });
    
    // Her satıra kaç masa sığar hesapla
    const tablesPerRow = Math.floor(availableWidth / spacing);
    
    let currentX = padding;
    let currentY = startY;
    let rowIndex = 0;
    let colIndex = 0;
    
    const arrangedTables = state.tables.map((table, index) => {
      // Grid'e snap
      const x = Math.round(currentX / gridSize) * gridSize;
      const y = Math.round(currentY / gridSize) * gridSize;
      
      // Sonraki pozisyon
      colIndex++;
      if (colIndex >= tablesPerRow) {
        colIndex = 0;
        rowIndex++;
        currentX = padding;
        currentY += spacing;
      } else {
        currentX += spacing;
      }
      
      return { ...table, x, y };
    });
    
    return { tables: arrangedTables };
  }),
  
  // Pending table counts - history kaydet
  pendingTableCounts: {},
  setPendingTableCounts: (counts) => set({ pendingTableCounts: counts }),
  placeAllPendingTables: () => {
    get().saveToHistory();
    set((state) => {
    const { pendingTableCounts, tableTypes, layout } = state;
    const totalPending = Object.values(pendingTableCounts).reduce((sum, c) => sum + c, 0);
    if (totalPending === 0) return state;

    const gridSize = layout.gridSize;
    const newTables: CanvasTable[] = [];
    const ts = Date.now();
    
    // Canvas boyutları - yeni oranlar
    const W = layout.width;   // 1100
    const H = layout.height;  // 700
    
    // Sahne T şekli - merkez koordinatları
    const centerX = W / 2; // 550
    
    // Sahne boyutları (küçültülmüş)
    const stageTopWidth = 200;
    const stageTopHeight = 50;
    const stageExtWidth = 80;
    const stageExtHeight = 200;
    const stageEndWidth = 120;
    const stageEndHeight = 30;
    const stageTopY = 30;
    
    // Sahne üst kısmı (geniş dikdörtgen)
    const stageTopLeft = centerX - stageTopWidth / 2;
    const stageTopRight = centerX + stageTopWidth / 2;
    const stageBottom = stageTopY + stageTopHeight;
    
    // Sahne uzantısı (T'nin dikey kısmı)
    const stageExtLeft = centerX - stageExtWidth / 2;
    const stageExtRight = centerX + stageExtWidth / 2;
    const stageExtBottom = stageBottom + stageExtHeight;
    
    // Sahne ön ucu
    const stageFrontLeft = centerX - stageEndWidth / 2;
    const stageFrontRight = centerX + stageEndWidth / 2;
    const stageFrontBottom = stageExtBottom + stageEndHeight;
    
    // System kontrol
    const sysKontrolY = stageFrontBottom + 80 + 35;
    
    // Loca alanı
    const locaAreaY = H - 60;
    
    // Masa aralıkları
    const spX = 42; // Yatay aralık
    const spY = 36; // Dikey aralık
    
    // Premium masalar için kenar pozisyonları (en dışta)
    const premiumLeftX = 35;
    const premiumRightX = W - 35;
    
    // Standart masalar için kenar pozisyonları
    const stdLeftStart = 70;
    const stdRightEnd = W - 70;
    
    // Masa türlerini bul - daha esnek eşleşme
    const stdType = tableTypes.find((t) => {
      const name = t.name.toLowerCase();
      return name.includes('standart') || name.includes('standard') || name.includes('normal');
    });
    const vipType = tableTypes.find((t) => t.name.toLowerCase().includes('vip'));
    const prmType = tableTypes.find((t) => {
      const name = t.name.toLowerCase();
      return name.includes('premium') || name.includes('özel') || name.includes('gold');
    });
    
    // Debug log
    console.log('placeAllPendingTables çağrıldı');
    console.log('tableTypes:', tableTypes.map((t) => ({ id: t.id, name: t.name })));
    console.log('pendingTableCounts:', pendingTableCounts);
    console.log('Bulunan türler:', { stdType: stdType?.name, vipType: vipType?.name, prmType: prmType?.name });
    
    // Eğer hiçbir tür bulunamadıysa, tüm pending masaları genel olarak yerleştir
    if (!stdType && !vipType && !prmType && totalPending > 0) {
      console.log('Özel tür bulunamadı, tüm masaları genel olarak yerleştiriyorum');
      let num = 1;
      Object.entries(pendingTableCounts).forEach(([typeId, count]) => {
        const type = tableTypes.find((t) => t.id === typeId);
        if (!type || type.name.toLowerCase() === 'loca') return;
        
        for (let i = 0; i < count; i++) {
          const row = Math.floor((num - 1) / 10);
          const col = (num - 1) % 10;
          newTables.push({
            id: `t${ts}-${num}`,
            typeId: type.id,
            typeName: type.name,
            x: Math.round((70 + col * spX) / gridSize) * gridSize,
            y: Math.round((100 + row * spY) / gridSize) * gridSize,
            rotation: 0,
            capacity: type.capacity,
            color: type.color,
            shape: type.shape,
            label: `${num}`,
          });
          num++;
        }
      });
      
      return {
        tables: [...state.tables, ...newTables],
        pendingTableCounts: {},
      };
    }
    
    const stdCount = stdType ? (pendingTableCounts[stdType.id] || 0) : 0;
    const vipCount = vipType ? (pendingTableCounts[vipType.id] || 0) : 0;
    const prmCount = prmType ? (pendingTableCounts[prmType.id] || 0) : 0;
    
    let num = 1;
    
    // ========== 1. STANDART MASALAR (mavi) ==========
    if (stdType && stdCount > 0) {
      let placed = 0;
      
      // Görseldeki gibi: Sol ve sağ tarafta masalar, ortada sahne
      // Satır satır yerleştir
      for (let row = 0; row < 15 && placed < stdCount; row++) {
        const y = 35 + row * spY;
        if (y > locaAreaY - 90) break;
        
        // Bu satırda sahne/system kontrol var mı kontrol et
        const inStageTopZone = y >= stageTopY - 10 && y < stageBottom + 10;
        const inStageExtZone = y >= stageBottom && y < stageExtBottom + 10;
        const inStageEndZone = y >= stageExtBottom && y < stageFrontBottom + 10;
        const inSysKontrolZone = y >= sysKontrolY - 25 && y < sysKontrolY + 45;
        
        // SOL TARAF masaları - sahne solunda
        let leftMaxX: number;
        if (inStageTopZone) {
          leftMaxX = stageTopLeft - 30;
        } else if (inStageExtZone) {
          leftMaxX = stageExtLeft - 30;
        } else if (inStageEndZone) {
          leftMaxX = stageFrontLeft - 30;
        } else if (inSysKontrolZone) {
          leftMaxX = centerX - 120;
        } else {
          // Sahne dışı - tam genişlik kullan
          leftMaxX = centerX - 30;
        }
        
        for (let col = 0; col < 12 && placed < stdCount; col++) {
          const x = stdLeftStart + col * spX;
          if (x > leftMaxX) break;
          
          newTables.push({
            id: `t${ts}-${num}`,
            typeId: stdType.id,
            typeName: stdType.name,
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize,
            rotation: 0,
            capacity: stdType.capacity,
            color: stdType.color,
            shape: stdType.shape,
            label: `${num}`,
          });
          num++;
          placed++;
        }
        
        // SAĞ TARAF masaları - sahne sağında
        let rightMinX: number;
        if (inStageTopZone) {
          rightMinX = stageTopRight + 30;
        } else if (inStageExtZone) {
          rightMinX = stageExtRight + 30;
        } else if (inStageEndZone) {
          rightMinX = stageFrontRight + 30;
        } else if (inSysKontrolZone) {
          rightMinX = centerX + 120;
        } else {
          // Sahne dışı - tam genişlik kullan
          rightMinX = centerX + 30;
        }
        
        for (let col = 0; col < 12 && placed < stdCount; col++) {
          const x = rightMinX + col * spX;
          if (x > stdRightEnd) break;
          
          newTables.push({
            id: `t${ts}-${num}`,
            typeId: stdType.id,
            typeName: stdType.name,
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize,
            rotation: 0,
            capacity: stdType.capacity,
            color: stdType.color,
            shape: stdType.shape,
            label: `${num}`,
          });
          num++;
          placed++;
        }
      }
      
      // Alt bölge (system kontrol altı, loca üstü) - tam genişlik
      const bottomStartY = sysKontrolY + 50;
      for (let row = 0; row < 3 && placed < stdCount; row++) {
        const y = bottomStartY + row * spY;
        if (y > locaAreaY - 60) break;
        
        for (let col = 0; col < 25 && placed < stdCount; col++) {
          const x = stdLeftStart + col * spX;
          if (x > stdRightEnd) break;
          
          newTables.push({
            id: `t${ts}-${num}`,
            typeId: stdType.id,
            typeName: stdType.name,
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize,
            rotation: 0,
            capacity: stdType.capacity,
            color: stdType.color,
            shape: stdType.shape,
            label: `${num}`,
          });
          num++;
          placed++;
        }
      }
    }
    
    // ========== 2. VIP MASALAR (yeşil) - Sahne önünde ==========
    if (vipType && vipCount > 0) {
      const vipY = stageFrontBottom + 15;
      const vipSp = 40;
      const vipCols = Math.min(vipCount, 4);
      const vipStartX = centerX - ((vipCols - 1) * vipSp) / 2;
      
      for (let i = 0; i < vipCount; i++) {
        const col = i % vipCols;
        const row = Math.floor(i / vipCols);
        const x = vipStartX + col * vipSp;
        const y = vipY + row * vipSp;
        
        newTables.push({
          id: `t${ts}-${num}`,
          typeId: vipType.id,
          typeName: vipType.name,
          x: Math.round(x / gridSize) * gridSize,
          y: Math.round(y / gridSize) * gridSize,
          rotation: 0,
          capacity: vipType.capacity,
          color: vipType.color,
          shape: vipType.shape,
          label: `${num}`,
        });
        num++;
      }
    }
    
    // ========== 3. PREMIUM MASALAR (sarı) - En dış kenarlarda ==========
    if (prmType && prmCount > 0) {
      let placed = 0;
      const prmSp = 40;
      const maxPerSide = Math.ceil(prmCount / 2);
      
      // Sol kenar (en dışta)
      for (let i = 0; i < maxPerSide && placed < prmCount; i++) {
        const x = premiumLeftX;
        const y = 100 + i * prmSp;
        
        if (y > locaAreaY - 80) break;
        
        newTables.push({
          id: `t${ts}-${num}`,
          typeId: prmType.id,
          typeName: prmType.name,
          x: Math.round(x / gridSize) * gridSize,
          y: Math.round(y / gridSize) * gridSize,
          rotation: 0,
          capacity: prmType.capacity,
          color: prmType.color,
          shape: prmType.shape,
          label: `${num}`,
        });
        num++;
        placed++;
      }
      
      // Sağ kenar (en dışta)
      for (let i = 0; placed < prmCount; i++) {
        const x = premiumRightX;
        const y = 100 + i * prmSp;
        
        if (y > locaAreaY - 80) break;
        
        newTables.push({
          id: `t${ts}-${num}`,
          typeId: prmType.id,
          typeName: prmType.name,
          x: Math.round(x / gridSize) * gridSize,
          y: Math.round(y / gridSize) * gridSize,
          rotation: 0,
          capacity: prmType.capacity,
          color: prmType.color,
          shape: prmType.shape,
          label: `${num}`,
        });
        num++;
        placed++;
      }
    }

    return {
      tables: [...state.tables, ...newTables],
      pendingTableCounts: {},
    };
  });
  },
  
  // Tüm masaları kaldır (Localar hariç)
  clearAllTables: () => {
    get().saveToHistory();
    set((state) => ({
      tables: state.tables.filter((t) => t.typeName?.toLowerCase() === 'loca' || t.typeId === 'loca'),
      selectedTableIds: [],
    }));
  },
}));
