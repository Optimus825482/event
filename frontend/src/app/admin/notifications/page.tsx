"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Eye,
  Users,
  Calendar,
  Star,
  Ticket,
  UserPlus,
  Megaphone,
  Clock,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
} from "lucide-react";
import { notificationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NotificationStats {
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    priority: string;
    targetRole: string;
    createdAt: string;
    event?: { id: string; name: string } | null;
  };
  totalReads: number;
  readers: { userId: string; fullName: string; readAt: string }[];
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  targetRole: string;
  createdAt: string;
  readCount?: number;
  event?: { id: string; name: string } | null;
}

const typeIcons: Record<string, React.ElementType> = {
  event_created: Calendar,
  event_updated: Calendar,
  venue_layout_completed: CheckCircle,
  team_organization_completed: Users,
  review_system_activated: Star,
  review_system_deactivated: Star,
  staff_review_completed: CheckCircle,
  reservation_system_activated: Ticket,
  new_staff_added: UserPlus,
  system_announcement: Megaphone,
};

const typeLabels: Record<string, string> = {
  event_created: "Yeni Etkinlik",
  event_updated: "Etkinlik Güncelleme",
  venue_layout_completed: "Mekan Yerleşimi",
  team_organization_completed: "Ekip Organizasyonu",
  review_system_activated: "Değerlendirme Aktif",
  review_system_deactivated: "Değerlendirme Kapalı",
  staff_review_completed: "Personel Değerlendirmesi",
  reservation_system_activated: "Rezervasyon Aktif",
  new_staff_added: "Yeni Personel",
  system_announcement: "Sistem Duyurusu",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-500/20 text-slate-400",
  medium: "bg-blue-500/20 text-blue-400",
  high: "bg-amber-500/20 text-amber-400",
  urgent: "bg-red-500/20 text-red-400",
};

const targetRoleLabels: Record<string, string> = {
  all: "Herkes",
  admin: "Yöneticiler",
  leader: "Liderler",
  staff: "Personel",
};

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState<string>("");
  const limit = 20;

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await notificationsApi.getAllNotifications({
        limit,
        offset: page * limit,
        type: filterType || undefined,
      });
      setNotifications(response.data.notifications);
      setTotal(response.data.total);
    } catch (error) {
      console.error("Bildirimler yüklenemedi:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, filterType]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleViewStats = async (notificationId: string) => {
    setIsLoadingStats(true);
    try {
      const response = await notificationsApi.getNotificationStats(
        notificationId
      );
      setSelectedNotification(response.data);
    } catch (error) {
      console.error("İstatistikler yüklenemedi:", error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <Bell className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Bildirim Yönetimi
              </h1>
              <p className="text-slate-400 text-sm">
                Sistem bildirimlerini görüntüle ve takip et
              </p>
            </div>
          </div>
          <button
            onClick={fetchNotifications}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Yenile
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(0);
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Tüm Tipler</option>
              {Object.entries(typeLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-slate-400">
            Toplam: <span className="text-white font-medium">{total}</span>{" "}
            bildirim
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications List */}
          <div className="lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Bell className="w-12 h-12 mb-3 opacity-30" />
                <p>Bildirim bulunamadı</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-700">
                  {notifications.map((notification) => {
                    const Icon = typeIcons[notification.type] || Bell;
                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-4 hover:bg-slate-700/50 transition-colors cursor-pointer",
                          selectedNotification?.notification.id ===
                            notification.id && "bg-slate-700/50"
                        )}
                        onClick={() => handleViewStats(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-700 rounded-lg">
                            <Icon className="w-5 h-5 text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-white truncate">
                                {notification.title}
                              </h3>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-xs",
                                  priorityColors[notification.priority]
                                )}
                              >
                                {notification.priority}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(notification.createdAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {targetRoleLabels[notification.targetRole]}
                              </span>
                              {notification.readCount !== undefined && (
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {notification.readCount} görüntüleme
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Önceki
                    </button>
                    <span className="text-sm text-slate-400">
                      Sayfa {page + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={page >= totalPages - 1}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
                    >
                      Sonraki
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Stats Panel */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-400" />
              Görüntüleme Detayları
            </h2>

            {isLoadingStats ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              </div>
            ) : selectedNotification ? (
              <div>
                <div className="bg-slate-700/50 rounded-lg p-3 mb-4">
                  <h3 className="font-medium text-white mb-1">
                    {selectedNotification.notification.title}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {selectedNotification.notification.message}
                  </p>
                </div>

                <div className="flex items-center justify-between mb-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <span className="text-amber-400">Toplam Görüntüleme</span>
                  <span className="text-2xl font-bold text-white">
                    {selectedNotification.totalReads}
                  </span>
                </div>

                <h4 className="text-sm font-medium text-slate-300 mb-2">
                  Görüntüleyenler
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {selectedNotification.readers.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                      Henüz kimse görüntülemedi
                    </p>
                  ) : (
                    selectedNotification.readers.map((reader, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg"
                      >
                        <span className="text-sm text-white">
                          {reader.fullName}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(reader.readAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Eye className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm text-center">
                  Detayları görmek için bir bildirim seçin
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
