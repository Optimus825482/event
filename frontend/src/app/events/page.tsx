'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Users, Loader2 } from 'lucide-react';
import { eventsApi } from '@/lib/api';

interface Event {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  totalCapacity: number;
  reservedCount?: number;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await eventsApi.getAll();
        setEvents(response.data || []);
      } catch (error) {
        console.error('Etkinlikler yüklenemedi:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Etkinlikler</h1>
            <p className="text-slate-400">Tüm etkinliklerinizi yönetin</p>
          </div>
          <Link
            href="/events/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Yeni Etkinlik
          </Link>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-4">Henüz etkinlik oluşturulmamış</p>
            <Link
              href="/events/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg"
            >
              <Plus className="w-5 h-5" />
              İlk Etkinliği Oluştur
            </Link>
          </div>
        ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-blue-500 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold">{event.name}</h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    event.status === 'published'
                      ? 'bg-green-600/20 text-green-400'
                      : 'bg-slate-600/20 text-slate-400'
                  }`}
                >
                  {event.status === 'published' ? 'Yayında' : 'Taslak'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(event.eventDate).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {event.reservedCount} / {event.totalCapacity} kişi
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{
                      width: `${((event.reservedCount || 0) / (event.totalCapacity || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
