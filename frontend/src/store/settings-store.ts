import { create } from 'zustand';
import { settingsApi } from '@/lib/api';

// Masa Türü Ayarları
export interface TableTypeConfig {
  id: string;
  name: string;
  capacity: number;
  color: string;
  shape: 'round' | 'rectangle' | 'square';
  minSpacing: number;
  isActive: boolean;
}

// Personel Renkleri
export interface StaffColor {
  id: string;
  name: string;
  color: string;
}

// Sistem Ayarları
export interface SystemSettings {
  id?: string;
  companyName: string;
  logo?: string;
  timezone: string;
  language: string;
  defaultGridSize: number;
  snapToGrid: boolean;
  showGridByDefault: boolean;
  defaultGuestCount: number;
  allowOverbooking: boolean;
  requirePhoneNumber: boolean;
  requireEmail: boolean;
  autoCheckInEnabled: boolean;
  checkInSoundEnabled: boolean;
  showTableDirections: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  // SMTP Ayarları
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  smtpSecure?: boolean;
  // Özellik Bayrakları
  qrCodeSystemEnabled: boolean;
  invitationSystemEnabled: boolean;
}

interface SettingsState {
  // Data
  tableTypes: TableTypeConfig[];
  staffColors: StaffColor[];
  systemSettings: SystemSettings | null;

  // Loading states
  isFetching: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions - System Settings
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<SystemSettings>) => Promise<void>;

  // Actions - Table Types
  fetchTableTypes: () => Promise<void>;
  addTableType: (
    type: Omit<TableTypeConfig, "id" | "isActive">,
  ) => Promise<void>;
  updateTableType: (
    id: string,
    updates: Partial<TableTypeConfig>,
  ) => Promise<void>;
  deleteTableType: (id: string) => Promise<void>;

  // Actions - Staff Colors
  fetchStaffColors: () => Promise<void>;
  addStaffColor: (color: Omit<StaffColor, "id">) => Promise<void>;
  updateStaffColor: (id: string, updates: Partial<StaffColor>) => Promise<void>;
  deleteStaffColor: (id: string) => Promise<void>;
}

// Varsayılan sistem ayarları (API'den veri gelmezse)
const defaultSystemSettings: SystemSettings = {
  companyName: "Test Firması",
  timezone: "Europe/Istanbul",
  language: "tr",
  defaultGridSize: 20,
  snapToGrid: true,
  showGridByDefault: true,
  defaultGuestCount: 2,
  allowOverbooking: false,
  requirePhoneNumber: true,
  requireEmail: false,
  autoCheckInEnabled: false,
  checkInSoundEnabled: true,
  showTableDirections: true,
  emailNotifications: true,
  smsNotifications: false,
  qrCodeSystemEnabled: true,
  invitationSystemEnabled: true,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  tableTypes: [],
  staffColors: [],
  systemSettings: null,
  isFetching: false,
  isSaving: false,
  error: null,

  // ============ SYSTEM SETTINGS ============

  fetchSettings: async () => {
    set({ isFetching: true, error: null });
    try {
      const response = await settingsApi.get();
      set({ systemSettings: response.data, isFetching: false });
    } catch (error: any) {
      console.error("Settings fetch error:", error);
      // API hatası durumunda varsayılan ayarları kullan
      set({ systemSettings: defaultSystemSettings, isFetching: false });
    }
  },

  updateSettings: async (updates) => {
    set({ isSaving: true, error: null });
    try {
      const response = await settingsApi.update(updates);
      set({ systemSettings: response.data, isSaving: false });
    } catch (error: any) {
      set({ error: error.message, isSaving: false });
      throw error;
    }
  },

  // ============ TABLE TYPES ============

  fetchTableTypes: async () => {
    try {
      const response = await settingsApi.getTableTypes();
      set({ tableTypes: response.data });
    } catch (error: any) {
      console.error("Table types fetch error:", error);
    }
  },

  addTableType: async (type) => {
    try {
      const response = await settingsApi.createTableType(type);
      set((state) => ({ tableTypes: [...state.tableTypes, response.data] }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  updateTableType: async (id, updates) => {
    try {
      const response = await settingsApi.updateTableType(id, updates);
      set((state) => ({
        tableTypes: state.tableTypes.map((t) =>
          t.id === id ? response.data : t,
        ),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteTableType: async (id) => {
    try {
      await settingsApi.deleteTableType(id);
      set((state) => ({
        tableTypes: state.tableTypes.filter((t) => t.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  // ============ STAFF COLORS ============

  fetchStaffColors: async () => {
    try {
      const response = await settingsApi.getStaffColors();
      set({ staffColors: response.data });
    } catch (error: any) {
      console.error("Staff colors fetch error:", error);
    }
  },

  addStaffColor: async (color) => {
    try {
      const response = await settingsApi.createStaffColor(color);
      set((state) => ({ staffColors: [...state.staffColors, response.data] }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  updateStaffColor: async (id, updates) => {
    try {
      const response = await settingsApi.updateStaffColor(id, updates);
      set((state) => ({
        staffColors: state.staffColors.map((c) =>
          c.id === id ? response.data : c,
        ),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteStaffColor: async (id) => {
    try {
      await settingsApi.deleteStaffColor(id);
      set((state) => ({
        staffColors: state.staffColors.filter((c) => c.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
}));
