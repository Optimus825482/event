'use client';

import { useState } from 'react';
import {
  Settings,
  Table2,
  Palette,
  Bell,
  Building,
  Grid3X3,
  QrCode,
  Ticket,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Alt sayfalar
import {
  TableTypesSettings,
  StaffColorsSettings,
  GeneralSettings,
  CanvasSettings,
  ReservationSettings,
  CheckInSettings,
  NotificationSettings,
} from './components';

type SettingsTab =
  | 'general'
  | 'table-types'
  | 'staff-colors'
  | 'canvas'
  | 'reservation'
  | 'checkin'
  | 'notifications';

const tabs: { id: SettingsTab; label: string; icon: any; description: string }[] = [
  { id: 'general', label: 'Genel Ayarlar', icon: Building, description: 'Firma bilgileri ve dil ayarları' },
  { id: 'table-types', label: 'Masa Türleri', icon: Table2, description: 'VIP, Standart, Loca tanımları' },
  { id: 'staff-colors', label: 'Ekip Renkleri', icon: Palette, description: 'Ekip atama renkleri' },
  { id: 'canvas', label: 'Canvas Ayarları', icon: Grid3X3, description: 'Izgara ve yerleşim ayarları' },
  { id: 'reservation', label: 'Rezervasyon', icon: Ticket, description: 'Rezervasyon kuralları' },
  { id: 'checkin', label: 'Check-in', icon: QrCode, description: 'QR ve giriş ayarları' },
  { id: 'notifications', label: 'Bildirimler', icon: Bell, description: 'E-posta ve SMS ayarları' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />;
      case 'table-types':
        return <TableTypesSettings />;
      case 'staff-colors':
        return <StaffColorsSettings />;
      case 'canvas':
        return <CanvasSettings />;
      case 'reservation':
        return <ReservationSettings />;
      case 'checkin':
        return <CheckInSettings />;
      case 'notifications':
        return <NotificationSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="w-8 h-8" />
            Ayarlar
          </h1>
          <p className="text-slate-400 mt-1">Sistem yapılandırması ve tercihler</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-72 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300'
                  )}
                >
                  <tab.icon className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{tab.label}</p>
                    <p className={cn(
                      'text-xs truncate',
                      activeTab === tab.id ? 'text-blue-200' : 'text-slate-500'
                    )}>
                      {tab.description}
                    </p>
                  </div>
                  <ChevronRight className={cn(
                    'w-4 h-4 flex-shrink-0',
                    activeTab === tab.id ? 'text-white' : 'text-slate-600'
                  )} />
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 bg-slate-800 rounded-xl p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
