'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, MapPin, Loader2 } from 'lucide-react';
import { generateId } from '@/lib/utils';

export default function NewEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    eventDate: '',
    eventTime: '',
    venue: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.eventDate) {
      alert('Lütfen etkinlik adı ve tarih giriniz');
      return;
    }

    setLoading(true);
    
    try {
      // Yeni etkinlik ID'si oluştur
      const eventId = generateId();
      
      // TODO: API'ye kaydet
      // await eventsApi.create({ ...formData });
      
      // Planlama sayfasına yönlendir
      router.push(`/events/${eventId}`);
    } catch (error) {
      console.error('Etkinlik oluşturma hatası:', error);
      alert('Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/events"
            className="p-2 bg-slate-800 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Yeni Etkinlik Oluştur</h1>
            <p className="text-slate-400">Etkinlik bilgilerini girin</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Temel Bilgiler */}
          <div className="bg-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold mb-4">Temel Bilgiler</h2>
            
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Etkinlik Adı *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                placeholder="Örn: Yılbaşı Galası 2025"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Tarih *
                </label>
                <input
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Saat
                </label>
                <input
                  type="time"
                  value={formData.eventTime}
                  onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Mekan
              </label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                placeholder="Mekan adı veya adresi"
              />
            </div>
          </div>

          {/* Bilgi Notu */}
          <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4">
            <p className="text-blue-200 text-sm">
              <strong>Not:</strong> Etkinlik oluşturulduktan sonra yerleşim planı sayfasında 
              masaları ekleyebilir ve düzenleyebilirsiniz.
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Link
              href="/events"
              className="px-6 py-3 bg-slate-700 rounded-lg"
            >
              İptal
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                'Oluştur ve Planla'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
