'use client';

import { useState, useEffect } from 'react';
import {
  QrCode,
  Camera,
  CheckCircle,
  XCircle,
  Users,
  MapPin,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface CheckInResult {
  success: boolean;
  message: string;
  data?: {
    customerName: string;
    tableLabel: string;
    guestCount: number;
    eventName: string;
  };
}

// Mock check-in fonksiyonu
const mockCheckIn = (qrCode: string): Promise<CheckInResult> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (qrCode === 'valid-qr' || qrCode.length > 5) {
        resolve({
          success: true,
          message: 'Giriş başarılı!',
          data: {
            customerName: 'Ahmet Yılmaz',
            tableLabel: 'VIP-3',
            guestCount: 8,
            eventName: 'Yılbaşı Galası 2025',
          },
        });
      } else {
        resolve({
          success: false,
          message: 'Geçersiz QR kod!',
        });
      }
    }, 1000);
  });
};

// Mock canlı istatistikler
const mockLiveStats = {
  totalExpected: 450,
  checkedIn: 287,
  remaining: 163,
};

export default function CheckInPage() {
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [stats, setStats] = useState(mockLiveStats);
  const [isOnline, setIsOnline] = useState(true);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckInResult['data'][]>([]);

  // Simüle canlı güncelleme
  useEffect(() => {
    const interval = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        checkedIn: Math.min(prev.totalExpected, prev.checkedIn + Math.floor(Math.random() * 2)),
        remaining: Math.max(0, prev.remaining - Math.floor(Math.random() * 2)),
      }));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleCheckIn = async (code: string) => {
    if (!code.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await mockCheckIn(code);
      setResult(response);

      if (response.success && response.data) {
        setRecentCheckIns((prev) => [response.data!, ...prev.slice(0, 4)]);
        setStats((prev) => ({
          ...prev,
          checkedIn: prev.checkedIn + 1,
          remaining: prev.remaining - 1,
        }));
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Bir hata oluştu',
      });
    } finally {
      setLoading(false);
      setManualCode('');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCheckIn(manualCode);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Check-in</h1>
            <p className="text-slate-400">QR kod okutarak giriş yapın</p>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="flex items-center gap-2 text-green-400 text-sm">
                <Wifi className="w-4 h-4" />
                Çevrimiçi
              </span>
            ) : (
              <span className="flex items-center gap-2 text-yellow-400 text-sm">
                <WifiOff className="w-4 h-4" />
                Çevrimdışı
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">{stats.totalExpected}</p>
            <p className="text-slate-400 text-sm">Toplam Beklenen</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-400">{stats.checkedIn}</p>
            <p className="text-slate-400 text-sm">Giriş Yapan</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-yellow-400">{stats.remaining}</p>
            <p className="text-slate-400 text-sm">Kalan</p>
          </div>
        </div>

        {/* QR Scanner Area */}
        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold">QR Kod Okuyucu</h2>
          </div>

          {/* Kamera alanı (placeholder) */}
          <div className="aspect-video bg-slate-900 rounded-lg flex items-center justify-center mb-4 border-2 border-dashed border-slate-700">
            <div className="text-center">
              <QrCode className="w-16 h-16 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500">Kamera erişimi için izin verin</p>
              <button className="mt-4 px-4 py-2 bg-blue-600 rounded-lg text-sm">
                Kamerayı Aç
              </button>
            </div>
          </div>

          {/* Manuel Giriş */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Manuel kod girişi..."
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !manualCode.trim()}
              className="px-6 py-3 bg-blue-600 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Kontrol Et'}
            </button>
          </form>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`rounded-xl p-6 mb-6 ${
              result.success
                ? 'bg-green-600/20 border border-green-500'
                : 'bg-red-600/20 border border-red-500'
            }`}
          >
            <div className="flex items-start gap-4">
              {result.success ? (
                <CheckCircle className="w-12 h-12 text-green-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-12 h-12 text-red-400 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className={`text-xl font-bold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                  {result.message}
                </h3>
                {result.data && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm">Misafir</p>
                      <p className="text-white font-medium">{result.data.customerName}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Masa</p>
                      <p className="text-white font-medium flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {result.data.tableLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Kişi Sayısı</p>
                      <p className="text-white font-medium flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {result.data.guestCount} kişi
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Etkinlik</p>
                      <p className="text-white font-medium">{result.data.eventName}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent Check-ins */}
        {recentCheckIns.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              Son Girişler
            </h3>
            <div className="space-y-3">
              {recentCheckIns.map((checkin, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="font-medium">{checkin?.customerName}</p>
                      <p className="text-sm text-slate-400">
                        {checkin?.tableLabel} • {checkin?.guestCount} kişi
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">Az önce</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
