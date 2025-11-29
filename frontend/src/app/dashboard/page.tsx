'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, CheckCircle, Clock, AlertCircle, 
  RefreshCw 
} from 'lucide-react';

// Mock canlı veriler
const mockLiveStats = {
  totalGuests: 450,
  checkedIn: 287,
  pending: 163,
  noShow: 12,
  occupancyRate: 64,
};

const mockRecentCheckIns = [
  { id: '1', name: 'Ahmet Yılmaz', table: 'VIP-3', time: '2 dk önce', guests: 4 },
  { id: '2', name: 'Ayşe Kaya', table: 'S-12', time: '5 dk önce', guests: 2 },
  { id: '3', name: 'Mehmet Demir', table: 'P-7', time: '8 dk önce', guests: 6 },
  { id: '4', name: 'Fatma Çelik', table: 'VIP-1', time: '12 dk önce', guests: 8 },
];

export default function DashboardPage() {
  const [stats, setStats] = useState(mockLiveStats);
  const [isLive, setIsLive] = useState(true);

  // Simüle canlı güncelleme
  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        checkedIn: Math.min(prev.totalGuests, prev.checkedIn + Math.floor(Math.random() * 3)),
        pending: Math.max(0, prev.pending - Math.floor(Math.random() * 3)),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [isLive]);

  const occupancyPercent = Math.round((stats.checkedIn / stats.totalGuests) * 100);

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Canlı Dashboard</h1>
            <p className="text-slate-400">Yılbaşı Galası 2025</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              isLive ? 'bg-green-600/20 text-green-400' : 'bg-slate-600/20 text-slate-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`} />
              {isLive ? 'Canlı' : 'Durduruldu'}
            </div>
            <button
              onClick={() => setIsLive(!isLive)}
              className="p-2 bg-slate-800 rounded-lg"
            >
              <RefreshCw className={`w-5 h-5 ${isLive ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Users}
            label="Toplam Misafir"
            value={stats.totalGuests}
            color="blue"
          />
          <StatCard
            icon={CheckCircle}
            label="Giriş Yapan"
            value={stats.checkedIn}
            color="green"
          />
          <StatCard
            icon={Clock}
            label="Beklenen"
            value={stats.pending}
            color="yellow"
          />
          <StatCard
            icon={AlertCircle}
            label="Gelmedi"
            value={stats.noShow}
            color="red"
          />
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Doluluk Oranı */}
          <div className="lg:col-span-2 bg-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Doluluk Oranı</h2>
            
            <div className="flex items-center gap-8">
              {/* Circular Progress */}
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="#1e293b"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="#3b82f6"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${occupancyPercent * 4.4} 440`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold">{occupancyPercent}%</span>
                </div>
              </div>

              {/* Detaylar */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Dolu Masalar</span>
                  <span className="font-medium">42 / 65</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Boş Masalar</span>
                  <span className="font-medium text-green-400">23</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Kapıdan Satış</span>
                  <span className="font-medium text-yellow-400">Açık</span>
                </div>
              </div>
            </div>
          </div>

          {/* Son Check-in'ler */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Son Girişler</h2>
            
            <div className="space-y-4">
              {mockRecentCheckIns.map((checkin) => (
                <div
                  key={checkin.id}
                  className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
                >
                  <div>
                    <p className="font-medium">{checkin.name}</p>
                    <p className="text-sm text-slate-400">
                      {checkin.table} • {checkin.guests} kişi
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{checkin.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/events/1"
            className="bg-slate-800 p-4 rounded-xl text-center"
          >
            <span className="text-slate-400 text-sm">Yerleşim Planı</span>
          </Link>
          <button className="bg-slate-800 p-4 rounded-xl text-center">
            <span className="text-slate-400 text-sm">QR Okuyucu</span>
          </button>
          <button className="bg-slate-800 p-4 rounded-xl text-center">
            <span className="text-slate-400 text-sm">Personel Listesi</span>
          </button>
          <button className="bg-slate-800 p-4 rounded-xl text-center">
            <span className="text-slate-400 text-sm">Raporlar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-600/20 text-blue-400',
    green: 'bg-green-600/20 text-green-400',
    yellow: 'bg-yellow-600/20 text-yellow-400',
    red: 'bg-red-600/20 text-red-400',
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-slate-400 text-sm">{label}</p>
    </div>
  );
}
