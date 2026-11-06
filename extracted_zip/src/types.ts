export interface NasItem {
  path: string;
  name: string;
  size: number;
  extension: string;
  modified: string;
  mode: number;
  isDir: boolean;
  isSymlink: boolean;
  type: string;
}

export interface NasFolderData {
  items: NasItem[];
  numDirs: number;
  numFiles: number;
  path: string;
  name: string;
  size: number;
  extension: string;
  modified: string;
}

export interface NasStatus {
  success: boolean;
  nasHost: string;
  user: string;
  latencyMs: number;
  authenticated: boolean;
  lastSyncCheck: number;
  autoSync: boolean;
  autoSyncInterval: number;
  deviceCount: number;
  error?: string;
}

export interface Device {
  id: string;
  name: string;
  type: 'browser' | 'android' | 'windows' | 'mac' | 'linux';
  ip: string;
  lastSeen: number;
  status: 'online' | 'syncing' | 'idle';
  clientVersion: string;
}

export interface SyncLog {
  id: string;
  timestamp: number;
  deviceId: string;
  deviceName: string;
  action: 'upload' | 'download' | 'sync' | 'delete' | 'mkdir';
  targetPath: string;
  status: 'success' | 'pending' | 'failed';
  details?: string;
}

export interface SyncState {
  autoSync: boolean;
  intervalMs: number;
  lastSyncTimestamp: number;
  devices: Device[];
  logs: SyncLog[];
}

export interface WebCredentials {
  nasWebUrl: string;
  nasLoginUrl: string;
  username: string;
  password: string;
  token: string | null;
  directAccessUrl: string;
  error?: string;
}

export interface ClipboardItem {
  action: 'copy' | 'move';
  items: NasItem[];
}

export interface UploadItemWithPath {
  file: File;
  relativePath: string;
}

export interface NasStorageStats {
  success: boolean;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercentage: number;
  freePercentage: number;
  volumeName: string;
  filesystem: string;
  server: string;
  updatedAt: number;
}
