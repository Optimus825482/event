'use client';

import { useState, useEffect } from 'react';
import { X, User, Check, Wand2, Users, AlertCircle } from 'lucide-react';
import { useCanvasStore } from '@/store/canvas-store';
import { User as UserType, StaffAssignment } from '@/types';
import { staffApi } from '@/lib/api';

interface StaffAssignmentPanelProps {
  onClose: () => void;
  eventId?: string;
}

// Fallback mock personel listesi (API çalışmazsa)
const fallbackStaff: UserType[] = [
  { id: '1', email: 'ahmet@staff.com', fullName: 'Ahmet (Garson)', role: 'staff', color: '#ef4444' },
  { id: '2', email: 'ayse@staff.com', fullName: 'Ayşe (Garson)', role: 'staff', color: '#22c55e' },
  { id: '3', email: 'mehmet@staff.com', fullName: 'Mehmet (Garson)', role: 'staff', color: '#3b82f6' },
  { id: '4', email: 'fatma@staff.com', fullName: 'Fatma (Şef Garson)', role: 'staff', color: '#eab308' },
];

export function StaffAssignmentPanel({ onClose, eventId }: StaffAssignmentPanelProps) {
  const { selectedTableIds, tables, updateTable, staffAssignments, setStaffAssignments } = useCanvasStore();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  // Personel listesini API'den yükle
  useEffect(() => {
    const loadStaff = async () => {
      try {
        const response = await staffApi.getAll(true); // Sadece aktif personel
        if (response.data && response.data.length > 0) {
          setStaffList(response.data.map((s: any) => ({
            id: s.id,
            email: s.email,
            fullName: s.fullName,
            role: 'staff' as const,
            color: s.color || '#3b82f6',
          })));
        } else {
          setStaffList(fallbackStaff);
        }
      } catch (error) {
        console.log('API bağlantısı yok, mock data kullanılıyor');
        setStaffList(fallbackStaff);
      } finally {
        setLoading(false);
      }
    };
    loadStaff();
  }, []);

  const selectedTables = tables.filter((t) => selectedTableIds.includes(t.id));

  const handleAssign = async () => {
    if (!selectedStaffId || selectedTableIds.length === 0) return;

    const staff = staffList.find((s) => s.id === selectedStaffId);
    if (!staff) return;

    // Masaları güncelle (local state)
    selectedTableIds.forEach((tableId) => {
      updateTable(tableId, {
        staffId: staff.id,
        staffColor: staff.color,
      });
    });

    // Staff assignment güncelle (local state)
    const existingAssignment = staffAssignments.find((a) => a.staffId === staff.id);
    
    if (existingAssignment) {
      const newTableIds = [...new Set([...existingAssignment.assignedTableIds, ...selectedTableIds])];
      setStaffAssignments(
        staffAssignments.map((a) =>
          a.staffId === staff.id ? { ...a, assignedTableIds: newTableIds } : a
        )
      );
    } else {
      const newAssignment: StaffAssignment = {
        id: `assign-${Date.now()}`,
        eventId: eventId || '',
        staffId: staff.id,
        staffName: staff.fullName,
        staffColor: staff.color || '#3b82f6',
        assignedTableIds: selectedTableIds,
      };
      setStaffAssignments([...staffAssignments, newAssignment]);
    }

    // API'ye kaydet (opsiyonel - backend varsa)
    if (eventId) {
      try {
        await staffApi.assignTables({
          eventId,
          staffId: staff.id,
          tableIds: [...new Set([
            ...(existingAssignment?.assignedTableIds || []),
            ...selectedTableIds,
          ])],
          color: staff.color,
        });
      } catch (error) {
        console.log('API kayıt başarısız, local state güncellendi');
      }
    }

    onClose();
  };

  const handleRemoveAssignment = async () => {
    const staffId = selectedTables[0]?.staffId;
    
    selectedTableIds.forEach((tableId) => {
      updateTable(tableId, {
        staffId: undefined,
        staffColor: undefined,
      });
    });

    // Staff assignments'tan da kaldır
    setStaffAssignments(
      staffAssignments.map((a) => ({
        ...a,
        assignedTableIds: a.assignedTableIds.filter((id) => !selectedTableIds.includes(id)),
      })).filter((a) => a.assignedTableIds.length > 0)
    );

    // API'den kaldır
    if (eventId && staffId) {
      try {
        const assignment = staffAssignments.find((a) => a.staffId === staffId);
        if (assignment) {
          const remainingTables = assignment.assignedTableIds.filter(
            (id) => !selectedTableIds.includes(id)
          );
          if (remainingTables.length > 0) {
            await staffApi.assignTables({
              eventId,
              staffId,
              tableIds: remainingTables,
            });
          } else {
            await staffApi.removeAssignment(eventId, staffId);
          }
        }
      } catch (error) {
        console.log('API güncelleme başarısız');
      }
    }

    onClose();
  };

  // Seçili masaların mevcut ataması
  const currentAssignment = selectedTables[0]?.staffId
    ? staffList.find((s) => s.id === selectedTables[0].staffId)
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold">Personel Ata</h2>
            <p className="text-sm text-slate-400">
              {selectedTableIds.length} masa seçili
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seçili Masalar */}
        <div className="p-4 border-b border-slate-700">
          <p className="text-sm text-slate-400 mb-2">Seçili Masalar:</p>
          <div className="flex flex-wrap gap-2">
            {selectedTables.map((table) => (
              <span
                key={table.id}
                className="px-3 py-1 bg-slate-700 rounded text-sm"
                style={{ borderLeft: `3px solid ${table.staffColor || table.color}` }}
              >
                {table.label}
              </span>
            ))}
          </div>
        </div>

        {/* Mevcut Atama */}
        {currentAssignment && (
          <div className="p-4 bg-slate-700/50 border-b border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Mevcut Atama:</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: currentAssignment.color }}
                >
                  <User className="w-4 h-4 text-white" />
                </div>
                <span>{currentAssignment.fullName}</span>
              </div>
              <button
                onClick={handleRemoveAssignment}
                className="text-sm text-red-400"
              >
                Kaldır
              </button>
            </div>
          </div>
        )}

        {/* Personel Listesi */}
        <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
          <p className="text-sm text-slate-400 mb-2">Personel Seç:</p>
          {loading ? (
            <div className="text-center py-4 text-slate-400">Yükleniyor...</div>
          ) : staffList.length === 0 ? (
            <div className="text-center py-4">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-500 mb-2" />
              <p className="text-slate-400 text-sm">Henüz personel eklenmemiş</p>
              <a href="/staff" className="text-blue-400 text-sm">
                Personel Ekle →
              </a>
            </div>
          ) : (
            staffList.map((staff) => {
              const assignedCount = staffAssignments.find(
                (a) => a.staffId === staff.id
              )?.assignedTableIds.length || 0;

              return (
                <button
                  key={staff.id}
                  onClick={() => setSelectedStaffId(staff.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    selectedStaffId === staff.id
                      ? 'bg-blue-600/20 border border-blue-500'
                      : 'bg-slate-700'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: staff.color }}
                  >
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{staff.fullName}</p>
                    <p className="text-sm text-slate-400">
                      {assignedCount} masa atanmış
                    </p>
                  </div>
                  {selectedStaffId === staff.id && (
                    <Check className="w-5 h-5 text-blue-400" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-700 rounded-lg"
          >
            İptal
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedStaffId}
            className="flex-1 py-3 bg-blue-600 rounded-lg font-medium disabled:opacity-50"
          >
            Ata
          </button>
        </div>
      </div>
    </div>
  );
}
