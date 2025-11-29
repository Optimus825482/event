import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 
  | 'reservation' 
  | 'checkin' 
  | 'event' 
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  userId?: string;
  actionUrl?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50), // Max 50 bildirim
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (notification && !notification.read) {
        return {
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        };
      }
      return state;
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  removeNotification: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: notification && !notification.read 
          ? Math.max(0, state.unreadCount - 1) 
          : state.unreadCount,
      };
    });
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },
}));

// Bildirim helper fonksiyonları
export const notify = {
  reservation: (title: string, message: string, actionUrl?: string) => {
    useNotificationStore.getState().addNotification({
      type: 'info',
      category: 'reservation',
      title,
      message,
      actionUrl,
    });
  },
  
  checkin: (title: string, message: string, actionUrl?: string) => {
    useNotificationStore.getState().addNotification({
      type: 'success',
      category: 'checkin',
      title,
      message,
      actionUrl,
    });
  },
  
  event: (title: string, message: string, actionUrl?: string) => {
    useNotificationStore.getState().addNotification({
      type: 'info',
      category: 'event',
      title,
      message,
      actionUrl,
    });
  },
  
  system: (title: string, message: string, type: NotificationType = 'info') => {
    useNotificationStore.getState().addNotification({
      type,
      category: 'system',
      title,
      message,
    });
  },
};
