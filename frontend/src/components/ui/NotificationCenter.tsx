'use client';

import { useState } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  CheckCheck, 
  Trash2,
  Calendar,
  Ticket,
  QrCode,
  Settings,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { useNotificationStore, Notification, NotificationCategory, NotificationType } from '@/store/notification-store';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const categoryIcons: Record<NotificationCategory, any> = {
  reservation: Ticket,
  checkin: QrCode,
  event: Calendar,
  system: Settings,
};

const typeColors: Record<NotificationType, string> = {
  info: 'text-blue-400',
  success: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
};

const typeIcons: Record<NotificationType, any> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    removeNotification,
    clearAll,
  } = useNotificationStore();

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dk önce`;
    if (hours < 24) return `${hours} saat önce`;
    return `${days} gün önce`;
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 rounded-lg"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-slate-800 rounded-xl border border-slate-700 shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold">Bildirimler</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-400 flex items-center gap-1"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Tümünü Okundu İşaretle
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Bildirim yok</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={() => markAsRead(notification.id)}
                    onRemove={() => removeNotification(notification.id)}
                    formatTime={formatTime}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-700">
                <button
                  onClick={clearAll}
                  className="text-sm text-slate-400 flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Tümünü Temizle
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onRead,
  onRemove,
  formatTime,
}: {
  notification: Notification;
  onRead: () => void;
  onRemove: () => void;
  formatTime: (date: Date) => string;
}) {
  const CategoryIcon = categoryIcons[notification.category];
  const TypeIcon = typeIcons[notification.type];

  const content = (
    <div
      className={cn(
        'flex gap-3 px-4 py-3 border-b border-slate-700/50 transition-colors',
        !notification.read && 'bg-slate-700/30'
      )}
      onClick={onRead}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 mt-1', typeColors[notification.type])}>
        <TypeIcon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('font-medium text-sm', !notification.read && 'text-white')}>
            {notification.title}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-slate-500 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-slate-400 mt-0.5">{notification.message}</p>
        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
          <CategoryIcon className="w-3 h-3" />
          <span>{formatTime(notification.timestamp)}</span>
          {!notification.read && (
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </div>
      </div>
    </div>
  );

  if (notification.actionUrl) {
    return (
      <Link href={notification.actionUrl} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
