import { create } from "zustand";
import { notificationsApi } from "@/lib/api";

// Backend'den gelen bildirim tipleri
export type NotificationType =
  | "event_created"
  | "event_updated"
  | "event_cancelled"
  | "venue_layout_completed"
  | "team_organization_completed"
  | "review_system_activated"
  | "review_system_deactivated"
  | "staff_review_completed"
  | "staff_review_updated"
  | "reservation_system_activated"
  | "reservation_system_deactivated"
  | "team_assignment_changed"
  | "staff_added_to_team"
  | "staff_removed_from_team"
  | "table_group_changed"
  | "new_staff_added"
  | "system_announcement";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";
export type NotificationTargetRole = "all" | "admin" | "leader" | "staff";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  targetRole: NotificationTargetRole;
  eventId: string | null;
  createdById: string | null;
  metadata: Record<string, unknown> | null;
  actionUrl: string | null;
  isActive: boolean;
  createdAt: string;
  isRead?: boolean;
  event?: {
    id: string;
    name: string;
  } | null;
  createdBy?: {
    id: string;
    fullName: string;
  } | null;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  total: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchNotifications: (options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Partial<Notification>) => void;
  clearError: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  total: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async (options = {}) => {
    // Auth kontrolü - token yoksa API çağrısı yapma
    const authStorage = localStorage.getItem("auth-storage");
    if (!authStorage) {
      set({ isLoading: false });
      return;
    }
    try {
      const parsed = JSON.parse(authStorage);
      if (!parsed?.state?.token || !parsed?.state?.isAuthenticated) {
        set({ isLoading: false });
        return;
      }
    } catch {
      set({ isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await notificationsApi.getNotifications(options);
      const data = response.data;
      set({
        notifications: data.notifications,
        total: data.total,
        unreadCount: data.unreadCount,
        isLoading: false,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Bildirimler yüklenemedi";
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    // Auth kontrolü - token yoksa API çağrısı yapma
    const authStorage = localStorage.getItem("auth-storage");
    if (!authStorage) return;
    try {
      const parsed = JSON.parse(authStorage);
      if (!parsed?.state?.token || !parsed?.state?.isAuthenticated) return;
    } catch {
      return;
    }

    try {
      const response = await notificationsApi.getUnreadCount();
      set({ unreadCount: response.data.unreadCount });
    } catch {
      // Sessizce başarısız ol
    }
  },

  markAsRead: async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // Sessizce başarısız ol
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationsApi.markAllAsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch {
      // Sessizce başarısız ol
    }
  },

  // WebSocket'ten gelen yeni bildirimi ekle
  addNotification: (notification: Partial<Notification>) => {
    const newNotification: Notification = {
      id: notification.id || crypto.randomUUID(),
      type: (notification.type as NotificationType) || "system_announcement",
      title: notification.title || "",
      message: notification.message || "",
      priority: (notification.priority as NotificationPriority) || "medium",
      targetRole: (notification.targetRole as NotificationTargetRole) || "all",
      eventId: notification.eventId || null,
      createdById: notification.createdById || null,
      metadata: notification.metadata || null,
      actionUrl: notification.actionUrl || null,
      isActive: true,
      createdAt: notification.createdAt || new Date().toISOString(),
      isRead: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
      total: state.total + 1,
    }));
  },

  clearError: () => set({ error: null }),
}));

// Bildirim tipi için ikon ve renk mapping
export const notificationTypeConfig: Record<
  NotificationType,
  { icon: string; color: string; bgColor: string }
> = {
  event_created: {
    icon: "Calendar",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  event_updated: {
    icon: "Calendar",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  event_cancelled: {
    icon: "CalendarX",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
  venue_layout_completed: {
    icon: "MapPin",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
  },
  team_organization_completed: {
    icon: "Users",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
  },
  review_system_activated: {
    icon: "Star",
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
  },
  review_system_deactivated: {
    icon: "StarOff",
    color: "text-slate-400",
    bgColor: "bg-slate-500/20",
  },
  staff_review_completed: {
    icon: "CheckCircle",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
  },
  staff_review_updated: {
    icon: "RefreshCw",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
  },
  reservation_system_activated: {
    icon: "Ticket",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
  },
  reservation_system_deactivated: {
    icon: "TicketX",
    color: "text-slate-400",
    bgColor: "bg-slate-500/20",
  },
  team_assignment_changed: {
    icon: "UserCog",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
  },
  staff_added_to_team: {
    icon: "UserPlus",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
  },
  staff_removed_from_team: {
    icon: "UserMinus",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
  table_group_changed: {
    icon: "LayoutGrid",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/20",
  },
  new_staff_added: {
    icon: "UserPlus",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
  },
  system_announcement: {
    icon: "Megaphone",
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
  },
};

// Öncelik renkleri
export const priorityColors: Record<NotificationPriority, string> = {
  low: "border-slate-600",
  medium: "border-blue-600",
  high: "border-amber-600",
  urgent: "border-red-600",
};
