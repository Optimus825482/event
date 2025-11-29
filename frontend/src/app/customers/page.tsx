'use client';

import { useState } from 'react';
import { 
  Search, Plus, Phone, Mail, Star, AlertTriangle, 
  MoreVertical 
} from 'lucide-react';
import { formatPhone } from '@/lib/utils';

// Mock data
const mockCustomers = [
  {
    id: '1',
    fullName: 'Ahmet Yılmaz',
    phone: '5321234567',
    email: 'ahmet@email.com',
    vipScore: 85,
    tags: ['vip', 'sahne_onu_sever'],
    isBlacklisted: false,
    totalEvents: 12,
    notes: 'Özel günlerde masa tercih eder',
  },
  {
    id: '2',
    fullName: 'Ayşe Kaya',
    phone: '5339876543',
    email: 'ayse@email.com',
    vipScore: 45,
    tags: ['vegan'],
    isBlacklisted: false,
    totalEvents: 3,
    notes: '',
  },
  {
    id: '3',
    fullName: 'Mehmet Demir',
    phone: '5441112233',
    email: '',
    vipScore: 20,
    tags: ['sorunlu'],
    isBlacklisted: true,
    totalEvents: 2,
    notes: 'Geçmiş etkinlikte sorun çıkardı',
  },
];

const tagLabels: Record<string, { label: string; color: string }> = {
  vip: { label: 'VIP', color: 'bg-yellow-600' },
  vegan: { label: 'Vegan', color: 'bg-green-600' },
  sahne_onu_sever: { label: 'Sahne Önü', color: 'bg-purple-600' },
  bahsis_birakir: { label: 'Bahşiş', color: 'bg-blue-600' },
  sorunlu: { label: 'Dikkat', color: 'bg-red-600' },
};

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredCustomers = mockCustomers.filter(
    (c) =>
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Müşteriler</h1>
            <p className="text-slate-400">CRM ve VIP analizi</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg"
          >
            <Plus className="w-5 h-5" />
            Yeni Müşteri
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="İsim veya telefon ile ara..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Customer List */}
        <div className="space-y-4">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className={`bg-slate-800 rounded-xl p-6 border ${
                customer.isBlacklisted
                  ? 'border-red-500/50'
                  : 'border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                      customer.isBlacklisted
                        ? 'bg-red-600/20 text-red-400'
                        : 'bg-blue-600/20 text-blue-400'
                    }`}
                  >
                    {customer.fullName.charAt(0)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {customer.fullName}
                      </h3>
                      {customer.isBlacklisted && (
                        <span className="flex items-center gap-1 text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          Kara Liste
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {formatPhone(customer.phone)}
                      </span>
                      {customer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {customer.email}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-2 mt-3">
                      {customer.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-xs px-2 py-1 rounded ${
                            tagLabels[tag]?.color || 'bg-slate-600'
                          }`}
                        >
                          {tagLabels[tag]?.label || tag}
                        </span>
                      ))}
                    </div>

                    {customer.notes && (
                      <p className="mt-2 text-sm text-slate-400 italic">
                        "{customer.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right">
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="font-medium">{customer.vipScore}</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {customer.totalEvents} etkinlik
                  </p>
                  <button className="mt-2 p-2 bg-slate-700 rounded-lg">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredCustomers.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Müşteri bulunamadı
          </div>
        )}
      </div>
    </div>
  );
}
