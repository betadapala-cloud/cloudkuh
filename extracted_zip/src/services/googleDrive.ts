import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { api } from './api';
import { logActivityToCloud } from './firebase';

// Initialize Firebase App singleton safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');

// Cached in memory and persisted in localStorage so browser reloads do not require re-login
let cachedAccessToken: string | null = typeof window !== 'undefined'
  ? localStorage.getItem('cloudku_gdrive_access_token')
  : null;
let isSigningIn = false;

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string; // bytes as string from Google Drive API
  modifiedTime?: string;
  thumbnailLink?: string;
  iconLink?: string;
  webViewLink?: string;
  parents?: string[];
  isFolder: boolean;
}

export interface DriveQuota {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
}

/**
 * Validate if an access token is still active with Google Drive API
 */
export const validateDriveToken = async (token: string): Promise<boolean> => {
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
};

/**
 * Initialize auth listener to monitor Google account sign-in state
 * Automatically recovers token from storage so user does not have to re-login on reload.
 */
export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // 1. Check existing in-memory token
      if (cachedAccessToken) {
        const isValid = await validateDriveToken(cachedAccessToken);
        if (isValid) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
          return;
        } else {
          cachedAccessToken = null;
          localStorage.removeItem('cloudku_gdrive_access_token');
        }
      }

      // 2. Check stored token in localStorage
      const storedToken = localStorage.getItem('cloudku_gdrive_access_token');
      if (storedToken) {
        const isValid = await validateDriveToken(storedToken);
        if (isValid) {
          cachedAccessToken = storedToken;
          if (onAuthSuccess) onAuthSuccess(user, storedToken);
          return;
        } else {
          localStorage.removeItem('cloudku_gdrive_access_token');
        }
      }

      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('cloudku_gdrive_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Sign in using Google Auth Popup requesting Google Drive scope
 * Persists session and records activity to Cloud Firestore
 */
export const signInWithGoogleDrive = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Tidak dapat memperoleh token akses dari Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('cloudku_gdrive_access_token', cachedAccessToken);
    localStorage.setItem('cloudku_gdrive_token_time', Date.now().toString());

    // Record login activity to Cloud Firestore
    logActivityToCloud({
      actionType: 'login',
      title: `Masuk akun Google Drive (${result.user.email || result.user.displayName || 'Pengguna'})`,
      details: 'Sesi Google Drive tersimpan di Cloud Firestore',
      status: 'success',
    });

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    cachedAccessToken = localStorage.getItem('cloudku_gdrive_access_token');
  }
  return cachedAccessToken;
};

export const signOutGoogleDrive = async (): Promise<void> => {
  const email = auth.currentUser?.email || auth.currentUser?.displayName;
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem('cloudku_gdrive_access_token');
  localStorage.removeItem('cloudku_gdrive_token_time');

  // Record logout activity to Cloud Firestore
  logActivityToCloud({
    actionType: 'login',
    title: `Keluar dari akun Google Drive (${email || 'Akun'})`,
    details: 'Sesi Google Drive ditutup',
    status: 'success',
  });
};

/**
 * Fetch storage quota from Google Drive API
 */
export const getDriveStorageQuota = async (): Promise<DriveQuota | null> => {
  const token = getDriveAccessToken();
  if (!token) return null;

  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.storageQuota || null;
  } catch {
    return null;
  }
};

/**
 * List files and folders inside Google Drive
 */
export const listDriveFiles = async (
  folderId = 'root',
  queryFilter = ''
): Promise<{ files: DriveItem[]; folderName?: string }> => {
  const token = getDriveAccessToken();
  if (!token) {
    throw new Error('Belum masuk ke Google Drive. Silakan hubungkan akun Google Anda.');
  }

  // Construct query: not trashed, and inside target folder
  let q = `'${folderId}' in parents and trashed = false`;
  if (queryFilter.trim()) {
    const escaped = queryFilter.replace(/'/g, "\\'");
    q += ` and name contains '${escaped}'`;
  }

  const fields = 'files(id, name, mimeType, size, modifiedTime, thumbnailLink, iconLink, webViewLink, parents)';
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=${encodeURIComponent(fields)}&orderBy=folder,name&pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('Sesi Google Drive telah berakhir. Silakan login kembali.');
    }
    throw new Error(errorBody.error?.message || `Gagal mengambil berkas Drive (${res.status})`);
  }

  const data = await res.json();
  const rawFiles: any[] = data.files || [];

  const items: DriveItem[] = rawFiles.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    modifiedTime: f.modifiedTime,
    thumbnailLink: f.thumbnailLink,
    iconLink: f.iconLink,
    webViewLink: f.webViewLink,
    parents: f.parents,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }));

  // Also get folder name if not root
  let folderName = folderId === 'root' ? 'Google Drive (Root)' : undefined;
  if (folderId !== 'root') {
    try {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        folderName = meta.name;
      }
    } catch {
      // Ignore
    }
  }

  return { files: items, folderName };
};

/**
 * Download file blob directly from Google Drive API
 * Supports binary files (PDF, images, videos, audio, Office) as well as Google Docs/Sheets/Slides exports
 */
export const downloadDriveFileBlob = async (fileId: string, mimeType?: string): Promise<Blob> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Belum masuk ke Google Drive.');

  // If this is a native Google Doc / Sheet / Slide, use the export endpoint
  let url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  if (mimeType === 'application/vnd.google-apps.document') {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/pdf`;
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
  } else if (mimeType === 'application/vnd.google-apps.presentation') {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/pdf`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    // If standard alt=media failed with 403 or 400, attempt PDF export fallback
    if (res.status === 403 || res.status === 400) {
      try {
        const fallbackRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/pdf`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (fallbackRes.ok) {
          return await fallbackRes.blob();
        }
      } catch {
        // continue to error
      }
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal mengunduh berkas dari Drive (${res.status})`);
  }

  return await res.blob();
};

/**
 * Upload a Blob or File to Google Drive using multipart upload
 */
export const uploadBlobToDrive = async (
  blob: Blob,
  fileName: string,
  mimeType: string,
  folderId = 'root'
): Promise<DriveItem> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Belum masuk ke Google Drive.');

  const metadata: any = {
    name: fileName,
    mimeType: mimeType || 'application/octet-stream',
  };

  if (folderId && folderId !== 'root') {
    metadata.parents = [folderId];
  }

  const boundary = '-------cloudku_gdrive_' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata);

  const mediaPartHeader =
    delimiter +
    `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`;

  const blobArrayBuffer = await blob.arrayBuffer();

  const multipartBlob = new Blob([
    metaPart,
    mediaPartHeader,
    blobArrayBuffer,
    closeDelimiter,
  ], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBlob,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal mengunggah ke Google Drive (${res.status})`);
  }

  const created = await res.json();
  return {
    id: created.id,
    name: created.name,
    mimeType: created.mimeType,
    size: created.size,
    modifiedTime: created.modifiedTime,
    webViewLink: created.webViewLink,
    isFolder: created.mimeType === 'application/vnd.google-apps.folder',
  };
};

/**
 * Create a new folder in Google Drive
 */
export const createDriveFolder = async (
  folderName: string,
  parentFolderId = 'root'
): Promise<DriveItem> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Belum masuk ke Google Drive.');

  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentFolderId && parentFolderId !== 'root') {
    metadata.parents = [parentFolderId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal membuat folder di Google Drive');
  }

  const created = await res.json();
  return {
    id: created.id,
    name: created.name,
    mimeType: created.mimeType,
    modifiedTime: created.modifiedTime,
    isFolder: true,
  };
};

/**
 * Delete a file or folder in Google Drive
 */
export const deleteDriveItem = async (fileId: string): Promise<void> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Belum masuk ke Google Drive.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal menghapus item dari Google Drive');
  }
};

/**
 * Recursively transfer an entire folder from Google Drive to Portal NAS
 */
export const transferDriveFolderToNas = async (
  driveFolderId: string,
  driveFolderName: string,
  targetNasParentDir: string,
  onProgress?: (info: { currentFile: string; completed: number; total: number }) => void
): Promise<{ success: boolean; filesTransferred: number; foldersCreated: number }> => {
  const cleanParent = targetNasParentDir.endsWith('/') && targetNasParentDir.length > 1
    ? targetNasParentDir.slice(0, -1)
    : targetNasParentDir;
  const rootNasFolder = cleanParent === '/' ? `/${driveFolderName}` : `${cleanParent}/${driveFolderName}`;

  // 1. Create root folder in NAS
  try {
    await api.createFolder(rootNasFolder);
  } catch {
    // Already exists or root
  }

  interface TaskItem {
    driveFile: DriveItem;
    targetNasDir: string;
  }
  const filesQueue: TaskItem[] = [];
  let foldersCreated = 1;

  const discover = async (folderId: string, currentNasPath: string) => {
    const res = await listDriveFiles(folderId);
    for (const item of res.files) {
      if (item.isFolder) {
        const subNasPath = `${currentNasPath}/${item.name}`;
        try {
          await api.createFolder(subNasPath);
          foldersCreated++;
        } catch {
          // Ignore if exists
        }
        await discover(item.id, subNasPath);
      } else {
        filesQueue.push({
          driveFile: item,
          targetNasDir: currentNasPath,
        });
      }
    }
  };

  await discover(driveFolderId, rootNasFolder);

  // 2. Transfer discovered files
  let filesTransferred = 0;
  for (let i = 0; i < filesQueue.length; i++) {
    const task = filesQueue[i];
    if (onProgress) {
      onProgress({
        currentFile: task.driveFile.name,
        completed: i + 1,
        total: Math.max(1, filesQueue.length),
      });
    }

    try {
      const blob = await downloadDriveFileBlob(task.driveFile.id);
      const file = new File([blob], task.driveFile.name, {
        type: task.driveFile.mimeType || blob.type || 'application/octet-stream',
      });
      await api.uploadFile(task.targetNasDir, file);
      filesTransferred++;
    } catch (err: any) {
      console.error(`Error transferring file ${task.driveFile.name}:`, err);
    }
  }

  return { success: true, filesTransferred, foldersCreated };
};

/**
 * Recursively transfer an entire folder from NAS to Google Drive
 */
export const transferNasFolderToDrive = async (
  nasFolderPath: string,
  nasFolderName: string,
  targetDriveFolderId = 'root',
  onProgress?: (info: { currentFile: string; completed: number; total: number }) => void
): Promise<{ success: boolean; filesTransferred: number; foldersCreated: number }> => {
  // 1. Create top-level folder in Google Drive
  const rootDriveFolder = await createDriveFolder(nasFolderName, targetDriveFolderId);
  let foldersCreated = 1;

  interface QueueTask {
    nasFilePath: string;
    fileName: string;
    destDriveFolderId: string;
  }
  const fileTasks: QueueTask[] = [];

  // 2. Discover recursively on NAS
  const traverseNasDir = async (dirPath: string, currentDriveParentId: string) => {
    try {
      const res = await api.getFiles(dirPath);
      const items = res.data?.items || [];

      for (const item of items) {
        if (item.isDir) {
          // Create subfolder in Drive
          try {
            const subDriveFolder = await createDriveFolder(item.name, currentDriveParentId);
            foldersCreated++;
            await traverseNasDir(item.path, subDriveFolder.id);
          } catch (e) {
            console.error(`Gagal membuat subfolder Drive ${item.name}:`, e);
          }
        } else {
          fileTasks.push({
            nasFilePath: item.path,
            fileName: item.name,
            destDriveFolderId: currentDriveParentId,
          });
        }
      }
    } catch (e) {
      console.error(`Gagal membaca folder NAS ${dirPath}:`, e);
    }
  };

  await traverseNasDir(nasFolderPath, rootDriveFolder.id);

  // 3. Transfer all discovered files
  let filesTransferred = 0;
  for (let i = 0; i < fileTasks.length; i++) {
    const task = fileTasks[i];
    if (onProgress) {
      onProgress({
        currentFile: task.fileName,
        completed: i + 1,
        total: Math.max(1, fileTasks.length),
      });
    }

    try {
      const rawUrl = api.getRawFileUrl(task.nasFilePath);
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await uploadBlobToDrive(blob, task.fileName, blob.type, task.destDriveFolderId);
      filesTransferred++;
    } catch (err: any) {
      console.error(`Error transferring NAS file ${task.fileName} to Drive:`, err);
    }
  }

  return { success: true, filesTransferred, foldersCreated };
};
