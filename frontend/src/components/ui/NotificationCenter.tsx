"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  X,
  CheckCheck,
  Calendar,
  CalendarX,
  MapPin,
  Users,
  Star,
  StarOff,
  CheckCircle,
  RefreshCw,
  Ticket,
  UserCog,
  UserPlus,
  UserMinus,
  LayoutGrid,
  Megaphone,
  Clock,
  Loader2,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import {
  useNotificationStore,
  Notification,
  NotificationType,
  notificationTypeConfig,
  priorityColors,
} from "@/store/notification-store";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { socketService, NotificationPayload } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/components/ui/toast-notification";

// İkon mapping
const iconMap: Record<string, LucideIcon> = {
  Calendar,
  CalendarX,
  MapPin,
  Users,
  Star,
  StarOff,
  CheckCircle,
  RefreshCw,
  Ticket,
  TicketX: Ticket,
  UserCog,
  UserPlus,
  UserMinus,
  LayoutGrid,
  Megaphone,
};

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuthStore();
  const toast = useToast();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    addNotification,
  } = useNotificationStore();

  // WebSocket bağlantısı ve bildirim dinleyicisi
  useEffect(() => {
    if (!user?.id) return;

    // Socket bağlantısını başlat
    socketService.connect();
    socketService.joinUserRoom(user.id, user.role);

    // Yeni bildirim dinleyicisi
    const handleNewNotification = (payload: NotificationPayload) => {
      // Store'a ekle (tipleri cast et)
      addNotification({
        id: payload.id,
        type: payload.type as NotificationType,
        title: payload.title,
        message: payload.message,
        priority: payload.priority as "low" | "medium" | "high" | "urgent",
        targetRole: payload.targetRole as "all" | "admin" | "leader" | "staff",
        eventId: payload.eventId || null,
        actionUrl: payload.actionUrl || null,
        createdAt: payload.createdAt,
        metadata: payload.metadata || null,
      });

      // Toast göster
      toast.info(`${payload.title}: ${payload.message}`, 5000);
    };

    socketService.onNewNotification(handleNewNotification);

    return () => {
      socketService.offNewNotification();
    };
  }, [user?.id, user?.role, addNotification, toast]);

  // İlk yüklemede bildirimleri çek - sadece login olmuşsa
  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount();
    }
  }, [fetchUnreadCount, user?.id]);

  // Panel açıldığında bildirimleri yükle - sadece login olmuşsa
  useEffect(() => {
    if (isOpen && user?.id) {
      fetchNotifications({ limit: 20 });
    }
  }, [isOpen, fetchNotifications, user?.id]);

  const formatTime = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Az önce";
    if (minutes < 60) return `${minutes} dk önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    return date.toLocaleDateString("tr-TR");
  }, []);

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unreadCount > 99 ? "99+" : unreadCount}
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/80">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-slate-400" />
                <h3 className="font-semibold text-white">Bildirimler</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                    {unreadCount} yeni
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Tümünü Oku
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Yükleniyor...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Bildirim yok</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Yeni bildirimler burada görünecek
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={() => handleMarkAsRead(notification.id)}
                    formatTime={formatTime}
                    onClose={() => setIsOpen(false)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/80">
                <Link
                  href={
                    user?.role === "admin"
                      ? "/admin/notifications"
                      : user?.role === "leader"
                      ? "/leader/notifications"
                      : "/staff/notifications"
                  }
                  onClick={() => setIsOpen(false)}
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1"
                >
                  Tüm Bildirimleri Gör
                  <ExternalLink className="w-3 h-3" />
                </Link>
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
  formatTime,
  onClose,
}: {
  notification: Notification;
  onRead: () => void;
  formatTime: (date: string) => string;
  onClose: () => void;
}) {
  const config = notificationTypeConfig[notification.type as NotificationType];
  const IconComponent = config ? iconMap[config.icon] || Bell : Bell;
  const priorityBorder = priorityColors[notification.priority] || "";

  const handleClick = () => {
    if (!notification.isRead) {
      onRead();
    }
  };

  const content = (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 border-b border-slate-700/50 transition-colors cursor-pointer hover:bg-slate-700/50",
        !notification.isRead && "bg-slate-700/30",
        priorityBorder && `border-l-2 ${priorityBorder}`
      )}
      onClick={handleClick}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
          config?.bgColor || "bg-slate-600/20"
        )}
      >
        <IconComponent
          className={cn("w-5 h-5", config?.color || "text-slate-400")}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "font-medium text-sm line-clamp-1",
              !notification.isRead ? "text-white" : "text-slate-300"
            )}
          >
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
          )}
        </div>
        <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
          <Clock className="w-3 h-3" />
          <span>{formatTime(notification.createdAt)}</span>
          {notification.event && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 truncate max-w-[120px]">
                {notification.event.name}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (notification.actionUrl) {
    return (
      <Link
        href={notification.actionUrl}
        className="block"
        onClick={() => {
          handleClick();
          onClose();
        }}
      >
        {content}
      </Link>
    );
  }

  return content;
}
