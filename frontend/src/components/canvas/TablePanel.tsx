"use client";

import { useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { TableType, TableInstance } from "@/types";
import { generateId } from "@/lib/utils";
import { Plus, LayoutGrid, Minus } from "lucide-react";

// Hızlı toplu masa ekleme paneli
function QuickAddPanel({ tableTypes }: { tableTypes: TableType[] }) {
  const { addTable, layout, tables } = useCanvasStore();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const updateCount = (typeId: string, delta: number) => {
    setCounts((prev) => ({
      ...prev,
      [typeId]: Math.max(0, (prev[typeId] || 0) + delta),
    }));
  };

  const totalCount = Object.values(counts).reduce((sum, c) => sum + c, 0);

  const handlePlaceAll = () => {
    if (totalCount === 0) return;

    const W = layout.width;
    const H = layout.height;

    // Mevcut masaların en yüksek numarasını bul
    let maxNum = 0;
    tables.forEach((t) => {
      const labelNum = parseInt(t.label, 10);
      if (!isNaN(labelNum) && labelNum > maxNum) {
        maxNum = labelNum;
      }
    });

    // Çakışma kontrolü - 40px yarıçapında kontrol
    const isOccupied = (
      x: number,
      y: number,
      allTables: { x: number; y: number }[]
    ) => {
      // Mevcut masalarla kontrol
      for (const t of tables) {
        if (Math.abs(t.x - x) < 40 && Math.abs(t.y - y) < 40) return true;
      }
      // Yeni eklenen masalarla kontrol
      for (const t of allTables) {
        if (Math.abs(t.x - x) < 40 && Math.abs(t.y - y) < 40) return true;
      }
      return false;
    };

    // Sahne ve alan koordinatları
    const centerX = W / 2;
    const stageBottom = 330;
    const sysKontrolY = H - 135;
    const locaY = H - 80;

    // Masa türlerini ayır
    const vipTypes = tableTypes.filter((t) =>
      t.name.toLowerCase().includes("vip")
    );
    const premiumTypes = tableTypes.filter(
      (t) =>
        t.name.toLowerCase().includes("premium") ||
        t.name.toLowerCase().includes("özel")
    );
    const standardTypes = tableTypes.filter(
      (t) =>
        t.name.toLowerCase().includes("standart") ||
        t.name.toLowerCase().includes("standard")
    );

    let num = maxNum + 1;
    const newTables: {
      x: number;
      y: number;
      typeId: string;
      typeName: string;
      capacity: number;
      color: string;
      shape: string;
    }[] = [];

    // Masa aralıkları - daha sıkı yerleşim
    const spacing = 45;

    // Sahne koordinatları
    const stageLeftEdge = centerX - 100;
    const stageRightEdge = centerX + 100;
    const startY = 50; // Üstten başlangıç
    const endY = locaY - 40; // Loca'ya kadar

    // Tüm masaları tek bir listeye topla ve sırala (VIP > Premium > Standart)
    const allTypesToPlace: {
      type: TableType;
      count: number;
      priority: number;
    }[] = [];

    vipTypes.forEach((type) => {
      const count = counts[type.id] || 0;
      if (count > 0) allTypesToPlace.push({ type, count, priority: 1 });
    });
    premiumTypes.forEach((type) => {
      const count = counts[type.id] || 0;
      if (count > 0) allTypesToPlace.push({ type, count, priority: 2 });
    });
    standardTypes.forEach((type) => {
      const count = counts[type.id] || 0;
      if (count > 0) allTypesToPlace.push({ type, count, priority: 3 });
    });

    // Öncelik sırasına göre sırala
    allTypesToPlace.sort((a, b) => a.priority - b.priority);

    // ========== 1. VIP MASALARI - Sahne önünde ==========
    allTypesToPlace
      .filter((t) => t.priority === 1)
      .forEach(({ type, count }) => {
        let placed = 0;
        const vipStartY = stageBottom + 25;

        // VIP için 4 sütun, gerektiği kadar satır
        for (let row = 0; placed < count && row < 4; row++) {
          for (let col = 0; placed < count && col < 4; col++) {
            const x = centerX - 75 + col * spacing;
            const y = vipStartY + row * spacing;
            if (y > sysKontrolY - 50) break;

            if (!isOccupied(x, y, newTables)) {
              newTables.push({
                x,
                y,
                typeId: type.id,
                typeName: type.name,
                capacity: type.capacity,
                color: type.color,
                shape: type.shape,
              });
              placed++;
            }
          }
        }
      });

    // ========== 2. PREMIUM MASALARI - Sahnenin yanlarında ==========
    allTypesToPlace
      .filter((t) => t.priority === 2)
      .forEach(({ type, count }) => {
        let placed = 0;

        // Sol ve sağ tarafta sahneye yakın yerleştir
        for (let row = 0; placed < count && row < 20; row++) {
          const y = startY + row * spacing;
          if (y > endY) break;
          if (y >= sysKontrolY - 30 && y <= sysKontrolY + 30) continue;

          // Sol taraf - sahneye yakın 2 sütun
          for (let col = 0; placed < count && col < 2; col++) {
            const x = stageLeftEdge - 50 - col * spacing;
            if (x < 40) break;

            if (!isOccupied(x, y, newTables)) {
              newTables.push({
                x,
                y,
                typeId: type.id,
                typeName: type.name,
                capacity: type.capacity,
                color: type.color,
                shape: type.shape,
              });
              placed++;
            }
          }

          // Sağ taraf - sahneye yakın 2 sütun
          for (let col = 0; placed < count && col < 2; col++) {
            const x = stageRightEdge + 50 + col * spacing;
            if (x > W - 40) break;

            if (!isOccupied(x, y, newTables)) {
              newTables.push({
                x,
                y,
                typeId: type.id,
                typeName: type.name,
                capacity: type.capacity,
                color: type.color,
                shape: type.shape,
              });
              placed++;
            }
          }
        }
      });

    // ========== 3. STANDART MASALARI - Kalan tüm boş alanlar ==========
    allTypesToPlace
      .filter((t) => t.priority === 3)
      .forEach(({ type, count }) => {
        let placed = 0;

        // Tüm canvas'ı tara, boş yerlere yerleştir
        for (let row = 0; placed < count && row < 30; row++) {
          const y = startY + row * spacing;
          if (y > endY) break;
          if (y >= sysKontrolY - 30 && y <= sysKontrolY + 30) continue;

          // Sol taraf - dış kenardan başla
          for (let col = 0; placed < count && col < 10; col++) {
            const x = 50 + col * spacing;
            // Sahne alanına girme
            if (
              y < stageBottom + 20 &&
              x > stageLeftEdge - 60 &&
              x < stageRightEdge + 60
            )
              continue;
            // VIP alanına girme
            if (
              y >= stageBottom &&
              y < sysKontrolY - 60 &&
              x > centerX - 100 &&
              x < centerX + 100
            )
              continue;
            if (x > centerX - 30) break; // Ortaya kadar

            if (!isOccupied(x, y, newTables)) {
              newTables.push({
                x,
                y,
                typeId: type.id,
                typeName: type.name,
                capacity: type.capacity,
                color: type.color,
                shape: type.shape,
              });
              placed++;
            }
          }

          // Sağ taraf - dış kenardan başla
          for (let col = 0; placed < count && col < 10; col++) {
            const x = W - 50 - col * spacing;
            // Sahne alanına girme
            if (
              y < stageBottom + 20 &&
              x > stageLeftEdge - 60 &&
              x < stageRightEdge + 60
            )
              continue;
            // VIP alanına girme
            if (
              y >= stageBottom &&
              y < sysKontrolY - 60 &&
              x > centerX - 100 &&
              x < centerX + 100
            )
              continue;
            if (x < centerX + 30) break; // Ortaya kadar

            if (!isOccupied(x, y, newTables)) {
              newTables.push({
                x,
                y,
                typeId: type.id,
                typeName: type.name,
                capacity: type.capacity,
                color: type.color,
                shape: type.shape,
              });
              placed++;
            }
          }
        }
      });

    // Tüm yeni masaları TableInstance olarak ekle
    newTables.forEach((t) => {
      const newTable: TableInstance = {
        id: generateId(),
        typeId: t.typeId,
        typeName: t.typeName,
        x: t.x,
        y: t.y,
        rotation: 0,
        capacity: t.capacity,
        color: t.color,
        shape: t.shape,
        label: `${num}`,
      };
      addTable(newTable);
      num++;
    });

    setCounts({});
  };

  const setCount = (typeId: string, value: number) => {
    setCounts((prev) => ({
      ...prev,
      [typeId]: Math.max(0, value),
    }));
  };

  return (
    <div className="p-3 bg-blue-600/20 rounded-lg border border-blue-600">
      <p className="text-sm text-blue-400 mb-3 font-medium">
        Hızlı Toplu Ekleme
      </p>
      <div className="space-y-3 mb-3">
        {tableTypes.map((type) => (
          <div key={type.id} className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-full flex-shrink-0"
              style={{ backgroundColor: type.color }}
            />
            <span className="text-white text-sm flex-1">
              {type.name} ({type.capacity} kişi)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateCount(type.id, -1)}
                className="p-1.5 bg-slate-600 rounded"
                disabled={(counts[type.id] || 0) === 0}
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                min={0}
                value={counts[type.id] || 0}
                onChange={(e) =>
                  setCount(type.id, parseInt(e.target.value) || 0)
                }
                className="w-14 text-center text-sm font-medium bg-slate-700 border border-slate-600 rounded py-1.5 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => updateCount(type.id, 1)}
                className="p-1.5 bg-slate-600 rounded"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {totalCount > 0 && (
        <button
          onClick={handlePlaceAll}
          className="w-full py-2 bg-blue-600 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2"
        >
          <LayoutGrid className="w-4 h-4" />
          Yerleştir ({totalCount} masa)
        </button>
      )}
    </div>
  );
}

export function TablePanel() {
  const { tableTypes, tables } = useCanvasStore();

  // Loca hariç masa türleri (Loca sabit olduğu için)
  const filteredTableTypes = tableTypes.filter(
    (t) => t.name.toLowerCase() !== "loca"
  );

  // Loca hariç masalar
  const nonLocaTables = tables.filter(
    (t) => t.typeName?.toLowerCase() !== "loca" && t.typeId !== "loca"
  );

  // Toplam kapasite hesapla (Localar dahil)
  const totalCapacity = tables.reduce((sum, t) => sum + (t.capacity || 0), 0);

  // Loca kapasitesi ayrı
  const locaCapacity = tables
    .filter((t) => t.typeName?.toLowerCase() === "loca" || t.typeId === "loca")
    .reduce((sum, t) => sum + (t.capacity || 0), 0);

  const locaCount = tables.filter(
    (t) => t.typeName?.toLowerCase() === "loca" || t.typeId === "loca"
  ).length;

  // Sadece Loca dışında masa varsa göster
  const hasNonLocaTables = nonLocaTables.length > 0;

  return (
    <div className="bg-slate-800 p-4 rounded-lg">
      {/* Toplam Kapasite Göstergesi - sadece masa eklendiğinde göster */}
      {hasNonLocaTables && (
        <div className="mb-4 p-3 bg-green-600/20 rounded-lg border border-green-600">
          <div className="flex items-center justify-between">
            <span className="text-green-400 text-sm font-medium">
              Toplam Kapasite
            </span>
            <span className="text-white font-bold text-lg">
              {totalCapacity} kişi
            </span>
          </div>
          <div className="text-xs text-green-400/70 mt-1">
            {nonLocaTables.length} masa + {locaCount} Loca ({locaCapacity} kişi)
          </div>
        </div>
      )}

      <h3 className="text-white font-semibold mb-3">Masa Ekle</h3>

      {/* Hızlı Toplu Ekleme */}
      {filteredTableTypes.length > 0 && (
        <QuickAddPanel tableTypes={filteredTableTypes} />
      )}

      {tableTypes.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-4">
          Henüz masa tipi tanımlanmamış
        </p>
      )}
    </div>
  );
}
