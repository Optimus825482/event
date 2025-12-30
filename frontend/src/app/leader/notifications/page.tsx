"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
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
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { notificationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  targetRole: string;
  actionUrl: string | null;
  createdAt: string;
  isRead?: boolean;
  event?: { id: string; name: string } | null;
}

const typeIcons: Record<string, LucideIcon> = {
  event_created: Calendar,
  event_updated: Calendar,
  event_cancelled: CalendarX,
  venue_layout_completed: MapPin,
  team_organization_completed: Users,
  review_system_activated: Star,
  review_system_deactivated: StarOff,
  staff_review_completed: CheckCircle,
  staff_review_updated: RefreshCw,
  reservation_system_activated: Ticket,
  reservation_system_deactivated: Ticket,
  team_assignment_changed: UserCog,
  staff_added_to_team: UserPlus,
  staff_removed_from_team: UserMinus,
  table_group_changed: LayoutGrid,
  new_staff_added: UserPlus,
  system_announcement: Megaphone,
};

const typeColors: Record<string, { icon: string; bg: string }> = {
  event_created: { icon: "text-blue-400", bg: "bg-blue-500/20" },
  event_updated: { icon: "text-blue-400", bg: "bg-blue-500/20" },
  event_cancelled: { icon: "text-red-400", bg: "bg-red-500/20" },
  venue_layout_completed: { icon: "text-green-400", bg: "bg-green-500/20" },
  team_organization_completed: {
    icon: "text-green-400",
    bg: "bg-green-500/20",
  },
  review_system_activated: { icon: "text-amber-400", bg: "bg-amber-500/20" },
  review_system_deactivated: { icon: "text-slate-400", bg: "bg-slate-500/20" },
  staff_review_completed: { icon: "text-green-400", bg: "bg-green-500/20" },
  staff_review_updated: { icon: "text-cyan-400", bg: "bg-cyan-500/20" },
  reservation_system_activated: {
    icon: "text-purple-400",
    bg: "bg-purple-500/20",
  },
  reservation_system_deactivated: {
    icon: "text-slate-400",
    bg: "bg-slate-500/20",
  },
  team_assignment_changed: { icon: "text-cyan-400", bg: "bg-cyan-500/20" },
  staff_added_to_team: { icon: "text-green-400", bg: "bg-green-500/20" },
  staff_removed_from_team: { icon: "text-red-400", bg: "bg-red-500/20" },
  table_group_changed: { icon: "text-indigo-400", bg: "bg-indigo-500/20" },
  new_staff_added: { icon: "text-emerald-400", bg: "bg-emerald-500/20" },
  system_announcement: { icon: "text-amber-400", bg: "bg-amber-500/20" },
};

const priorityColors: Record<string, string> = {
  low: "border-l-slate-500",
  medium: "border-l-blue-500",
  high: "border-l-amber-500",
  urgent: "border-l-red-500",
};

export default function LeaderNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const limit = 20;

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await notificationsApi.getNotifications({
        limit,
        offset: page * limit,
        unreadOnly: showUnreadOnly,
      });
      setNotifications(response.data.notifications);
      setTotal(response.data.total);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error("Bildirimler yüklenemedi:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, showUnreadOnly]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Bildirim okundu işaretlenemedi:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Bildirimler okundu işaretlenemedi:", error);
    }
  };

  const formatDate = (dateStr: string) => {
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
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <Bell className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Bildirimlerim</h1>
              <p className="text-slate-400 text-sm">
                {unreadCount > 0
                  ? `${unreadCount} okunmamış bildirim`
                  : "Tüm bildirimler okundu"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-amber-400 transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Tümünü Okundu İşaretle
              </button>
            )}
            <button
              onClick={fetchNotifications}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Yenile
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => {
              setShowUnreadOnly(!showUnreadOnly);
              setPage(0);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
              showUnreadOnly
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            <Bell className="w-4 h-4" />
            {showUnreadOnly ? "Sadece Okunmamışlar" : "Tüm Bildirimler"}
          </button>
          <div className="text-sm text-slate-400">
            Toplam: <span className="text-white font-medium">{total}</span>{" "}
            bildirim
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Bell className="w-12 h-12 mb-3 opacity-30" />
              <p>
                {showUnreadOnly
                  ? "Okunmamış bildirim yok"
                  : "Bildirim bulunamadı"}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-700">
                {notifications.map((notification) => {
                  const Icon = typeIcons[notification.type] || Bell;
                  const colors = typeColors[notification.type] || {
                    icon: "text-slate-400",
                    bg: "bg-slate-500/20",
                  };
                  const priorityBorder =
                    priorityColors[notification.priority] ||
                    "border-l-slate-500";

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 border-l-4 transition-colors",
                        priorityBorder,
                        !notification.isRead && "bg-slate-700/30"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn("p-2.5 rounded-lg", colors.bg)}>
                          <Icon className={cn("w-5 h-5", colors.icon)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3
                                  className={cn(
                                    "font-medium",
                                    !notification.isRead
                                      ? "text-white"
                                      : "text-slate-300"
                                  )}
                                >
                                  {notification.title}
                                </h3>
                                {!notification.isRead && (
                                  <span className="w-2 h-2 bg-amber-400 rounded-full" />
                                )}
                              </div>
                              <p className="text-sm text-slate-400 mb-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(notification.createdAt)}
                                </span>
                                {notification.event && (
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Calendar className="w-3 h-3" />
                                    {notification.event.name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!notification.isRead && (
                                <button
                                  onClick={() =>
                                    handleMarkAsRead(notification.id)
                                  }
                                  className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded-lg transition-colors"
                                  title="Okundu işaretle"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              {notification.actionUrl && (
                                <Link
                                  href={notification.actionUrl}
                                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
                                  title="Detaya git"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Link>
                              )}
                            </div>
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
      </div>
    </div>
  );
}
