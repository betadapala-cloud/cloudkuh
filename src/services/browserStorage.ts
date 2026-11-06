/**
 * Browser Storage Service (localStorage)
 * Menggantikan penyimpanan riwayat ke Cloud Firestore dengan penyimpanan lokal browser.
 * Menyimpan riwayat aktivitas dan status sesi aplikasi di browser secara cepat, privat, dan offline.
 */

export interface ActivityLog {
  id: string;
  actionType:
    | 'upload'
    | 'create_folder'
    | 'rename'
    | 'delete'
    | 'move'
    | 'copy'
    | 'transfer_drive'
    | 'preview'
    | 'login'
    | 'sync';
  title: string;
  details?: string;
  path?: string;
  itemCount?: number;
  status: 'success' | 'failed' | 'pending';
  createdAt: string;
}

export interface AppBrowserState {
  id: string;
  lastPath: string;
  activeTab: 'files' | 'gdrive' | 'sync' | 'portal';
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'size' | 'modified';
  sortAsc: boolean;
  lastActiveAt?: string;
  updatedAt: string;
}

const STORAGE_KEYS = {
  ACTIVITY_LOGS: 'cloudku_activity_history',
  APP_STATE: 'cloudku_saved_state',
};

const MAX_STORED_LOGS = 100;

/**
 * Simpan aktivitas pengguna ke browser localStorage
 */
export function logActivityToBrowser(
  entry: Omit<ActivityLog, 'id' | 'createdAt'>
): void {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newLog: ActivityLog = {
      ...entry,
      id: logId,
      createdAt: new Date().toISOString(),
    };

    const existingJson = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    let logs: ActivityLog[] = [];
    if (existingJson) {
      try {
        logs = JSON.parse(existingJson);
        if (!Array.isArray(logs)) logs = [];
      } catch {
        logs = [];
      }
    }

    // Sisipkan di awal (terbaru di atas) dan batasi maksimal 100 riwayat
    logs.unshift(newLog);
    if (logs.length > MAX_STORED_LOGS) {
      logs = logs.slice(0, MAX_STORED_LOGS);
    }

    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(logs));
  } catch (error) {
    console.warn('Gagal menyimpan riwayat ke browser localStorage:', error);
  }
}

/**
 * Ambil riwayat aktivitas dari penyimpanan browser
 */
export function fetchActivityLogsFromBrowser(maxItems = 50): ActivityLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, maxItems);
  } catch (error) {
    console.warn('Gagal memuat riwayat dari browser localStorage:', error);
    return [];
  }
}

/**
 * Hapus seluruh riwayat aktivitas dari browser
 */
export function clearActivityLogsFromBrowser(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS);
  } catch (error) {
    console.warn('Gagal menghapus riwayat dari browser:', error);
  }
}

/**
 * Simpan status navigasi & tampilan ke browser localStorage
 */
export function saveAppStateToBrowser(state: {
  lastPath: string;
  activeTab: 'files' | 'gdrive' | 'sync' | 'portal';
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'size' | 'modified';
  sortAsc: boolean;
}): void {
  try {
    const payload: AppBrowserState = {
      id: 'current_session',
      lastPath: state.lastPath || '/',
      activeTab: state.activeTab || 'files',
      viewMode: state.viewMode || 'grid',
      sortBy: state.sortBy || 'name',
      sortAsc: Boolean(state.sortAsc),
      lastActiveAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(payload));
  } catch (error) {
    console.warn('Gagal menyimpan status aplikasi ke browser:', error);
  }
}

/**
 * Muat status navigasi & tampilan dari browser localStorage saat aplikasi dibuka
 */
export function loadAppStateFromBrowser(): AppBrowserState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APP_STATE);
    if (!raw) return null;
    return JSON.parse(raw) as AppBrowserState;
  } catch (error) {
    console.warn('Gagal memuat status aplikasi dari browser:', error);
    return null;
  }
}

// Alias kompatibilitas agar kode yang memanggil nama lama tetap berfungsi tanpa kendala
export const logActivityToCloud = logActivityToBrowser;
export const fetchActivityLogsFromCloud = fetchActivityLogsFromBrowser;
export const saveAppStateToCloud = saveAppStateToBrowser;
export const loadAppStateFromCloud = loadAppStateFromBrowser;
