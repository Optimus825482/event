'use client';

import { useState } from 'react';
import { 
  Search, Plus, MapPin, Users, Download, 
  Globe, Lock, Star 
} from 'lucide-react';

// Mock data
const mockVenues = [
  {
    id: '1',
    name: 'Çırağan Sarayı Balo Salonu',
    isPublic: true,
    usageCount: 156,
    capacity: 500,
    createdBy: 'EventFlow Team',
    rating: 4.8,
  },
  {
    id: '2',
    name: 'Zorlu PSM Ana Sahne',
    isPublic: true,
    usageCount: 89,
    capacity: 1200,
    createdBy: 'EventFlow Team',
    rating: 4.6,
  },
  {
    id: '3',
    name: 'Özel Düğün Salonu',
    isPublic: false,
    usageCount: 12,
    capacity: 300,
    createdBy: 'Benim',
    rating: 0,
  },
];

export default function VenuesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');

  const filteredVenues = mockVenues.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'public' && v.isPublic) ||
      (filter === 'private' && !v.isPublic);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Mekan Şablonları</h1>
            <p className="text-slate-400">Marketplace ve kendi şablonlarınız</p>
          </div>
          <button className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg">
            <Plus className="w-5 h-5" />
            Yeni Şablon
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mekan ara..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            {(['all', 'public', 'private'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filter === f
                    ? 'bg-blue-600'
                    : 'bg-slate-800'
                }`}
              >
                {f === 'all' ? 'Tümü' : f === 'public' ? 'Marketplace' : 'Özel'}
              </button>
            ))}
          </div>
        </div>

        {/* Venues Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVenues.map((venue) => (
            <div
              key={venue.id}
              className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700"
            >
              {/* Preview */}
              <div className="h-40 bg-slate-700 flex items-center justify-center">
                <MapPin className="w-12 h-12 text-slate-500" />
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{venue.name}</h3>
                  {venue.isPublic ? (
                    <Globe className="w-4 h-4 text-green-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {venue.capacity}
                  </span>
                  <span className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    {venue.usageCount}
                  </span>
                  {venue.rating > 0 && (
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Star className="w-4 h-4 fill-current" />
                      {venue.rating}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {venue.createdBy}
                  </span>
                  <button className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded text-sm">
                    Kullan
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredVenues.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Şablon bulunamadı
          </div>
        )}
      </div>
    </div>
  );
}
