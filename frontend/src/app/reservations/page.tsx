'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Calendar,
  Users,
  QrCode,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
} from 'lucide-react';
import { formatDate, formatPhone } from '@/lib/utils';

// Mock data
const mockReservations = [
  {
    id: '1',
    eventName: 'Yılbaşı Galası 2025',
    eventDate: '2025-12-31T20:00:00',
    customerName: 'Ahmet Yılmaz',
    customerPhone: '5321234567',
    tableLabel: 'VIP-3',
    guestCount: 8,
    status: 'confirmed',
    checkInStatus: false,
    createdAt: '2025-01-15T10:30:00',
  },
  {
    id: '2',
    eventName: 'Yılbaşı Galası 2025',
    eventDate: '2025-12-31T20:00:00',
    customerName: 'Ayşe Kaya',
    customerPhone: '5339876543',
    tableLabel: 'S-12',
    guestCount: 4,
    status: 'confirmed',
    checkInStatus: true,
    createdAt: '2025-01-14T15:20:00',
  },
  {
    id: '3',
    eventName: 'Kurumsal Toplantı',
    eventDate: '2025-02-15T14:00:00',
    customerName: 'Mehmet Demir',
    customerPhone: '5441112233',
    tableLabel: 'P-7',
    guestCount: 6,
    status: 'pending',
    checkInStatus: false,
    createdAt: '2025-01-16T09:00:00',
  },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Onaylı', color: 'bg-green-600/20 text-green-400' },
  pending: { label: 'Beklemede', color: 'bg-yellow-600/20 text-yellow-400' },
  cancelled: { label: 'İptal', color: 'bg-red-600/20 text-red-400' },
};

export default function ReservationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredReservations = mockReservations.filter((r) => {
    const matchesSearch =
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerPhone.includes(searchQuery) ||
      r.tableLabel.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Rezervasyonlar</h1>
            <p className="text-slate-400">Tüm etkinlik rezervasyonlarını yönetin</p>
          </div>
          <Link
            href="/reservations/new"
            className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg"
          >
            <Plus className="w-5 h-5" />
            Yeni Rezervasyon
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Müşteri adı, telefon veya masa ara..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            {['all', 'confirmed', 'pending', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  statusFilter === status ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                {status === 'all' ? 'Tümü' : statusLabels[status]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reservations List */}
        <div className="space-y-4">
          {filteredReservations.map((reservation) => (
            <div
              key={reservation.id}
              className="bg-slate-800 rounded-xl p-6 border border-slate-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Müşteri Bilgisi */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{reservation.customerName}</h3>
                      <p className="text-sm text-slate-400">
                        {formatPhone(reservation.customerPhone)}
                      </p>
                    </div>
                    <span
                      className={`ml-auto px-2 py-1 rounded text-xs ${
                        statusLabels[reservation.status]?.color
                      }`}
                    >
                      {statusLabels[reservation.status]?.label}
                    </span>
                  </div>

                  {/* Detaylar */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Etkinlik</p>
                      <p className="text-slate-300">{reservation.eventName}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Tarih</p>
                      <p className="text-slate-300 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(reservation.eventDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Masa</p>
                      <p className="text-slate-300 font-medium">{reservation.tableLabel}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Kişi Sayısı</p>
                      <p className="text-slate-300">{reservation.guestCount} kişi</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-2 ml-4">
                  {reservation.checkInStatus ? (
                    <span className="flex items-center gap-1 text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Giriş Yapıldı
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400 text-sm">
                      <Clock className="w-4 h-4" />
                      Bekleniyor
                    </span>
                  )}
                  <button className="flex items-center gap-1 px-3 py-1 bg-slate-700 rounded text-sm">
                    <QrCode className="w-4 h-4" />
                    QR Göster
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredReservations.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Rezervasyon bulunamadı
          </div>
        )}
      </div>
    </div>
  );
}
