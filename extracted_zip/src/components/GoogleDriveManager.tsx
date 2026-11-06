import React, { useState, useEffect } from 'react';
import {
  initDriveAuth,
  signInWithGoogleDrive,
  signOutGoogleDrive,
  listDriveFiles,
  downloadDriveFileBlob,
  uploadBlobToDrive,
  createDriveFolder,
  deleteDriveItem,
  getDriveStorageQuota,
  transferDriveFolderToNas,
  transferNasFolderToDrive,
  DriveItem,
  DriveQuota,
} from '../services/googleDrive';
import { api } from '../services/api';
import { logActivityToCloud } from '../services/firebase';
import { NasItem, NasFolderData } from '../types';
import { formatBytes, formatDate } from '../utils/format';
import { User } from 'firebase/auth';
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  ArrowRightLeft,
  Upload,
  Download,
  FolderPlus,
  FolderDown,
  RefreshCw,
  Search,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  ChevronRight,
  LogOut,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  X,
  Check,
  Eye,
} from 'lucide-react';
import { DriveFileViewerModal } from './DriveFileViewerModal';

interface GoogleDriveManagerProps {
  currentNasPath: string;
  onRefreshNasFiles: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const GoogleDriveManager: React.FC<GoogleDriveManagerProps> = ({
  currentNasPath,
  onRefreshNasFiles,
  showToast,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<DriveQuota | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);

  // Folder navigation state
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([
    { id: 'root', name: 'Google Drive' },
  ]);
  const currentFolderId = folderStack[folderStack.length - 1].id;

  const [files, setFiles] = useState<DriveItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Drive Items
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Viewing Drive Item Modal (Office, PDF, Photos, Videos)
  const [viewingDriveItem, setViewingDriveItem] = useState<DriveItem | null>(null);

  // Modals
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');

  // Destructive delete confirmation modal
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<DriveItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Transfer from Drive to NAS confirmation & progress modal
  const [transferToNasModalOpen, setTransferToNasModalOpen] = useState<boolean>(false);
  const [itemsToTransferToNas, setItemsToTransferToNas] = useState<DriveItem[]>([]);
  const [isTransferringToNas, setIsTransferringToNas] = useState<boolean>(false);
  const [transferProgress, setTransferProgress] = useState<{ current: number; total: number; name: string }>({
    current: 0,
    total: 0,
    name: '',
  });

  // Transfer from NAS to Drive modal
  const [nasPickerModalOpen, setNasPickerModalOpen] = useState<boolean>(false);
  const [nasBrowsePath, setNasBrowsePath] = useState<string>(currentNasPath || '/');
  const [nasItems, setNasItems] = useState<NasItem[]>([]);
  const [isLoadingNasItems, setIsLoadingNasItems] = useState<boolean>(false);
  const [selectedNasPaths, setSelectedNasPaths] = useState<Set<string>>(new Set());
  const [isTransferringToDrive, setIsTransferringToDrive] = useState<boolean>(false);

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = initDriveAuth(
      (user) => {
        setCurrentUser(user);
        setIsLoadingAuth(false);
        loadQuota();
      },
      () => {
        setCurrentUser(null);
        setIsLoadingAuth(false);
        setFiles([]);
        setQuota(null);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch files when folder changes or user logs in
  useEffect(() => {
    if (currentUser) {
      fetchDriveFiles(currentFolderId, searchQuery);
    }
  }, [currentUser, currentFolderId]);

  const loadQuota = async () => {
    const q = await getDriveStorageQuota();
    if (q) setQuota(q);
  };

  const fetchDriveFiles = async (folderId: string, query = '') => {
    setIsLoadingFiles(true);
    try {
      const res = await listDriveFiles(folderId, query);
      setFiles(res.files);
      setSelectedItemIds(new Set());
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat berkas Google Drive', 'error');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const res = await signInWithGoogleDrive();
      if (res) {
        setCurrentUser(res.user);
        showToast(`Berhasil terhubung dengan Google Drive (${res.user.email})`, 'success');
        await loadQuota();
        await fetchDriveFiles('root');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal masuk dengan Google', 'error');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutGoogleDrive();
      setCurrentUser(null);
      setFiles([]);
      setFolderStack([{ id: 'root', name: 'Google Drive' }]);
      showToast('Koneksi Google Drive telah diputus', 'info');
    } catch {
      showToast('Gagal keluar dari Google Drive', 'error');
    }
  };

  const handleOpenFolder = (item: DriveItem) => {
    if (!item.isFolder) return;
    setFolderStack((prev) => [...prev, { id: item.id, name: item.name }]);
    setSearchQuery('');
  };

  const handleBreadcrumbClick = (index: number) => {
    setFolderStack((prev) => prev.slice(0, index + 1));
    setSearchQuery('');
  };

  const handleToggleSelect = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- ACTIONS: DRIVE -> NAS TRANSFER (SUPPORTS FILES AND FOLDERS) ---
  const handleStartTransferToNas = (items: DriveItem[]) => {
    if (items.length === 0) {
      showToast('Pilih setidaknya satu berkas atau folder untuk ditransfer ke NAS', 'info');
      return;
    }
    setItemsToTransferToNas(items);
    setTransferToNasModalOpen(true);
  };

  const handleConfirmTransferToNas = async () => {
    setTransferToNasModalOpen(false);
    setIsTransferringToNas(true);

    let successFilesCount = 0;
    let successFoldersCount = 0;
    const targetDir = currentNasPath || '/';

    for (let i = 0; i < itemsToTransferToNas.length; i++) {
      const item = itemsToTransferToNas[i];

      if (item.isFolder) {
        setTransferProgress({
          current: i + 1,
          total: itemsToTransferToNas.length,
          name: `Memindahkan Folder: ${item.name}`,
        });

        try {
          const res = await transferDriveFolderToNas(
            item.id,
            item.name,
            targetDir,
            (info) => {
              setTransferProgress({
                current: info.completed,
                total: info.total,
                name: `Folder ${item.name}: ${info.currentFile}`,
              });
            }
          );
          if (res.success) {
            successFoldersCount++;
            successFilesCount += res.filesTransferred;
          }
        } catch (err: any) {
          console.error(`Gagal mentransfer folder ${item.name}:`, err);
          showToast(`Gagal mentransfer folder "${item.name}": ${err.message}`, 'error');
        }
      } else {
        setTransferProgress({
          current: i + 1,
          total: itemsToTransferToNas.length,
          name: item.name,
        });

        try {
          // 1. Download blob from Google Drive API
          const blob = await downloadDriveFileBlob(item.id);
          const file = new File([blob], item.name, { type: item.mimeType || blob.type });

          // 2. Upload file to Portal NAS
          await api.uploadFile(targetDir, file);
          successFilesCount++;
        } catch (err: any) {
          console.error(`Gagal mentransfer ${item.name}:`, err);
          showToast(`Gagal mentransfer "${item.name}": ${err.message}`, 'error');
        }
      }
    }

    setIsTransferringToNas(false);
    if (successFilesCount > 0 || successFoldersCount > 0) {
      const msg = successFoldersCount > 0
        ? `Berhasil memindahkan ${successFoldersCount} folder (${successFilesCount} berkas) dari Google Drive ke Home Server (${targetDir})`
        : `Berhasil mentransfer ${successFilesCount} berkas dari Google Drive ke Home Server (${targetDir})`;
      logActivityToCloud({
        actionType: 'transfer_drive',
        title: `Transfer Drive -> Home Server`,
        details: `${successFoldersCount > 0 ? `${successFoldersCount} folder, ` : ''}${successFilesCount} berkas ke ${targetDir}`,
        path: targetDir,
        status: 'success',
      });
      showToast(msg, 'success');
      onRefreshNasFiles();
    }
  };

  // --- ACTIONS: NAS -> DRIVE TRANSFER ---
  const handleOpenNasPicker = async () => {
    setNasPickerModalOpen(true);
    setSelectedNasPaths(new Set());
    await loadNasFolder(currentNasPath || '/');
  };

  const loadNasFolder = async (path: string) => {
    setIsLoadingNasItems(true);
    setNasBrowsePath(path);
    try {
      const res = await api.getFiles(path);
      setNasItems(res.data.items || []);
    } catch (err: any) {
      showToast('Gagal memuat folder NAS: ' + err.message, 'error');
    } finally {
      setIsLoadingNasItems(false);
    }
  };

  const handleToggleSelectNasItem = (itemPath: string) => {
    setSelectedNasPaths((prev) => {
      const next = new Set(prev);
      if (next.has(itemPath)) next.delete(itemPath);
      else next.add(itemPath);
      return next;
    });
  };

  const handleConfirmTransferToDrive = async () => {
    const selectedItems = nasItems.filter((i) => selectedNasPaths.has(i.path));
    if (selectedItems.length === 0) {
      showToast('Pilih berkas atau folder dari NAS untuk ditransfer ke Google Drive', 'info');
      return;
    }

    setNasPickerModalOpen(false);
    setIsTransferringToDrive(true);

    let successFilesCount = 0;
    let successFoldersCount = 0;
    const destFolder = folderStack[folderStack.length - 1];

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];

      if (item.isDir) {
        setTransferProgress({
          current: i + 1,
          total: selectedItems.length,
          name: `Memindahkan Folder NAS: ${item.name}`,
        });

        try {
          const res = await transferNasFolderToDrive(
            item.path,
            item.name,
            destFolder.id,
            (info) => {
              setTransferProgress({
                current: info.completed,
                total: info.total,
                name: `Folder ${item.name}: ${info.currentFile}`,
              });
            }
          );
          if (res.success) {
            successFoldersCount++;
            successFilesCount += res.filesTransferred;
          }
        } catch (err: any) {
          console.error(`Gagal mentransfer folder NAS ${item.name}:`, err);
          showToast(`Gagal mentransfer folder "${item.name}" ke Google Drive: ${err.message}`, 'error');
        }
      } else {
        setTransferProgress({
          current: i + 1,
          total: selectedItems.length,
          name: item.name,
        });

        try {
          // 1. Fetch file blob from NAS raw endpoint
          const rawUrl = api.getRawFileUrl(item.path);
          const res = await fetch(rawUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status} saat membaca berkas NAS`);
          const blob = await res.blob();

          // 2. Upload to Google Drive
          await uploadBlobToDrive(blob, item.name, blob.type, destFolder.id);
          successFilesCount++;
        } catch (err: any) {
          console.error(`Gagal mentransfer ke Drive ${item.name}:`, err);
          showToast(`Gagal mengirim "${item.name}" ke Google Drive: ${err.message}`, 'error');
        }
      }
    }

    setIsTransferringToDrive(false);
    if (successFilesCount > 0 || successFoldersCount > 0) {
      const msg = successFoldersCount > 0
        ? `Berhasil memindahkan ${successFoldersCount} folder (${successFilesCount} berkas) dari NAS ke Google Drive (${destFolder.name})`
        : `Berhasil mentransfer ${successFilesCount} berkas dari NAS ke Google Drive (${destFolder.name})`;
      logActivityToCloud({
        actionType: 'transfer_drive',
        title: `Transfer Home Server -> Google Drive`,
        details: `${successFoldersCount > 0 ? `${successFoldersCount} folder, ` : ''}${successFilesCount} berkas ke folder Google Drive (${destFolder.name})`,
        path: destFolder.name,
        status: 'success',
      });
      showToast(msg, 'success');
      fetchDriveFiles(destFolder.id);
      loadQuota();
    }
  };

  // --- ACTIONS: CREATE FOLDER IN DRIVE ---
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await createDriveFolder(newFolderName.trim(), currentFolderId);
      showToast(`Folder "${newFolderName}" berhasil dibuat di Google Drive`, 'success');
      setNewFolderName('');
      setIsNewFolderModalOpen(false);
      fetchDriveFiles(currentFolderId);
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat folder di Google Drive', 'error');
    }
  };

  // --- ACTIONS: DELETE ITEM WITH CONFIRMATION (MANDATORY REQUIREMENT) ---
  const handleDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    setIsDeleting(true);
    try {
      await deleteDriveItem(deleteConfirmItem.id);
      showToast(`"${deleteConfirmItem.name}" berhasil dihapus dari Google Drive`, 'success');
      setDeleteConfirmItem(null);
      fetchDriveFiles(currentFolderId);
      loadQuota();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus item dari Google Drive', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Upload local files directly to Google Drive
  const handleLocalUploadToDrive = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    setIsTransferringToDrive(true);
    let successCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setTransferProgress({
        current: i + 1,
        total: fileList.length,
        name: file.name,
      });

      try {
        await uploadBlobToDrive(file, file.name, file.type, currentFolderId);
        successCount++;
      } catch (err: any) {
        showToast(`Gagal mengunggah ${file.name}: ${err.message}`, 'error');
      }
    }

    setIsTransferringToDrive(false);
    e.target.value = '';
    if (successCount > 0) {
      showToast(`Berhasil mengunggah ${successCount} berkas ke Google Drive`, 'success');
      fetchDriveFiles(currentFolderId);
      loadQuota();
    }
  };

  const getDriveItemIcon = (item: DriveItem) => {
    if (item.isFolder) {
      return <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20 shrink-0" />;
    }
    const mime = item.mimeType.toLowerCase();
    if (mime.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-emerald-400 shrink-0" />;
    }
    if (mime.startsWith('video/')) {
      return <Film className="w-5 h-5 text-rose-400 shrink-0" />;
    }
    if (mime.startsWith('audio/')) {
      return <Music className="w-5 h-5 text-purple-400 shrink-0" />;
    }
    return <FileText className="w-5 h-5 text-blue-400 shrink-0" />;
  };

  // Calculate storage usage percentage
  const usageBytes = quota?.usage ? parseInt(quota.usage, 10) : 0;
  const limitBytes = quota?.limit ? parseInt(quota.limit, 10) : 0;
  const usagePercentage = limitBytes > 0 ? Math.min(100, Math.round((usageBytes / limitBytes) * 100)) : 0;

  // Unauthenticated view
  if (!isLoadingAuth && !currentUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
          {/* Google Drive Logo badge */}
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700/80 flex items-center justify-center mb-6 shadow-inner">
            <svg className="w-10 h-10" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
            </svg>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Sinkronisasi Google Drive</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Hubungkan akun Google Drive Anda untuk mentransfer berkas secara dua arah: dari Google Drive ke Portal NAS CloudKu, dan sebaliknya dengan aman.
          </p>

          {/* Official Sign in with Google Button as mandated by Google guidelines */}
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-medium text-sm transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            <span>{isSigningIn ? 'Menghubungkan...' : 'Sign in with Google'}</span>
          </button>

          <div className="mt-6 pt-6 border-t border-slate-800/80 w-full flex items-center justify-around text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Akses Langsung
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Dua Arah (Drive &harr; NAS)
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden text-slate-200">
      {/* Top Bar: User details, Google Drive brand, Storage quota, and Controls */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Google Drive</h2>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Terhubung
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[250px] sm:max-w-md">
              {currentUser?.displayName || currentUser?.email}
            </p>
          </div>
        </div>

        {/* Quota & Action buttons */}
        <div className="flex items-center gap-3">
          {quota && limitBytes > 0 && (
            <div className="hidden sm:flex flex-col items-end text-xs">
              <span className="text-slate-400 font-mono text-[11px]">
                {formatBytes(usageBytes)} / {formatBytes(limitBytes)} ({usagePercentage}%)
              </span>
              <div className="w-28 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Transfer Buttons: Two-Way Sync Actions */}
          <button
            onClick={handleOpenNasPicker}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Pilih berkas dari NAS untuk ditransfer ke Google Drive"
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Transfer dari NAS ke Drive</span>
            <span className="sm:hidden">Dari NAS</span>
          </button>

          <button
            onClick={() => {
              const selectedItems = files.filter((f) => selectedItemIds.has(f.id));
              handleStartTransferToNas(selectedItems);
            }}
            disabled={selectedItemIds.size === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Transfer berkas terpilih dari Google Drive ke Portal NAS"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Transfer ke NAS ({selectedItemIds.size})</span>
            <span className="sm:hidden">Ke NAS</span>
          </button>

          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Putuskan Hubungan Google Drive"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation & Search toolbar */}
      <div className="p-3 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
          {folderStack.map((folder, index) => {
            const isLast = index === folderStack.length - 1;
            return (
              <React.Fragment key={folder.id}>
                {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors truncate max-w-[150px] ${
                    isLast
                      ? 'text-white font-medium bg-slate-800'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Search, Upload, New Folder, and Refresh controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari di Google Drive..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchDriveFiles(currentFolderId, e.target.value);
              }}
              className="pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
            />
          </div>

          <button
            onClick={() => setIsNewFolderModalOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors"
            title="Folder Baru di Drive"
          >
            <FolderPlus className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Folder Baru</span>
          </button>

          <label className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Unggah Berkas</span>
            <input
              type="file"
              multiple
              onChange={handleLocalUploadToDrive}
              className="hidden"
            />
          </label>

          <button
            onClick={() => fetchDriveFiles(currentFolderId, searchQuery)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Segarkan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Target NAS Folder Banner */}
      <div className="px-4 py-2 bg-blue-950/30 border-b border-blue-900/30 text-xs text-blue-300 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 truncate">
          <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-slate-400">Target Transfer ke Portal NAS:</span>
          <span className="font-mono font-medium text-white bg-blue-900/40 px-2 py-0.5 rounded border border-blue-800/60 truncate">
            {currentNasPath || '/'}
          </span>
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          Centang berkas untuk ditransfer bersamaan
        </span>
      </div>

      {/* Files List / Grid Container */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoadingFiles ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
            <span className="text-sm">Memuat berkas dari Google Drive...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Folder className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">Folder ini kosong</p>
              <p className="text-xs text-slate-500 mt-1">
                Gunakan tombol &quot;Transfer dari NAS ke Drive&quot; untuk mengirim berkas dari NAS.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {files.map((item) => {
              const isSelected = selectedItemIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`relative group rounded-xl p-3 border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500/60 shadow-md ring-1 ring-blue-500/30'
                      : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Selection checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(item.id);
                      }}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'border-slate-600 hover:border-slate-400 bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-3" />}
                    </button>

                    {/* Thumbnail or icon */}
                    <div
                      onClick={() => (item.isFolder ? handleOpenFolder(item) : setViewingDriveItem(item))}
                      className="cursor-pointer shrink-0"
                    >
                      {item.thumbnailLink ? (
                        <img
                          src={item.thumbnailLink}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-700 bg-slate-950 hover:opacity-90 transition-opacity"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center hover:bg-slate-700/80 transition-colors">
                          {getDriveItemIcon(item)}
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => (item.isFolder ? handleOpenFolder(item) : setViewingDriveItem(item))}
                    >
                      <h3
                        className="text-xs font-medium text-slate-200 group-hover:text-blue-400 truncate transition-colors"
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        {item.size ? <span>{formatBytes(parseInt(item.size, 10))}</span> : null}
                        {item.modifiedTime && <span>{formatDate(item.modifiedTime)}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                    {!item.isFolder ? (
                      <div className="flex items-center justify-between w-full gap-1.5">
                        <button
                          onClick={() => setViewingDriveItem(item)}
                          className="flex items-center gap-1 py-1 px-2.5 rounded-md bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
                          title={`Buka berkas ${item.name} (Office, PDF, Foto, Video)`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>Buka</span>
                        </button>
                        <button
                          onClick={() => handleStartTransferToNas([item])}
                          className="flex items-center gap-1 py-1 px-2 rounded-md bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 text-[11px] font-medium transition-colors cursor-pointer"
                          title={`Transfer ${item.name} ke Home Server NAS`}
                        >
                          <ArrowDownToLine className="w-3 h-3" />
                          <span>Ke NAS</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartTransferToNas([item]);
                          }}
                          className="flex items-center gap-1 py-1 px-2 rounded-md bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 text-[11px] font-medium transition-colors cursor-pointer"
                          title={`Pindahkan folder ${item.name} beserta isinya ke Home Server NAS`}
                        >
                          <FolderDown className="w-3 h-3" />
                          <span>Pindah ke NAS</span>
                        </button>
                        <button
                          onClick={() => handleOpenFolder(item)}
                          className="flex items-center gap-1 py-1 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          <span>Buka</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      {item.webViewLink && (
                        <a
                          href={item.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                          title="Buka di Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => setDeleteConfirmItem(item)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Hapus dari Google Drive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- CONFIRMATION MODAL: TRANSFER TO NAS --- */}
      {transferToNasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">Konfirmasi Transfer ke Home Server NAS</h3>
                <p className="text-xs text-slate-400">Transfer dari Google Drive ke Home Server</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span>Item yang akan ditransfer:</span>
                <span className="font-semibold text-white">
                  {itemsToTransferToNas.filter((i) => i.isFolder).length > 0 &&
                    `${itemsToTransferToNas.filter((i) => i.isFolder).length} folder, `}
                  {itemsToTransferToNas.filter((i) => !i.isFolder).length} berkas
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Folder tujuan NAS:</span>
                <span className="font-mono text-emerald-400 font-medium truncate max-w-[200px]">
                  {currentNasPath || '/'}
                </span>
              </div>

              {itemsToTransferToNas.some((i) => i.isFolder) && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-300 flex items-start gap-2">
                  <FolderDown className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>
                    Folder yang dipilih akan dipindahkan secara rekursif (termasuk seluruh subfolder dan berkas di dalamnya) ke Home Server NAS.
                  </span>
                </div>
              )}

              <div className="max-h-32 overflow-y-auto mt-2 pt-2 border-t border-slate-700/40 space-y-1">
                {itemsToTransferToNas.map((it) => (
                  <div key={it.id} className="text-slate-300 truncate flex items-center gap-1.5">
                    {it.isFolder ? (
                      <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                    ) : (
                      <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{it.name}</span>
                    {it.isFolder && (
                      <span className="text-[10px] text-amber-400 font-mono">(Folder utuh)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setTransferToNasModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmTransferToNas}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-2"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>Mulai Transfer ke NAS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: PICK NAS ITEMS TO TRANSFER TO DRIVE --- */}
      {nasPickerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <ArrowUpFromLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Pilih Berkas dari NAS</h3>
                  <p className="text-xs text-slate-400">
                    Tujuan Google Drive: <span className="text-blue-300 font-medium">{folderStack[folderStack.length - 1].name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNasPickerModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* NAS Breadcrumb */}
            <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 text-xs flex items-center gap-2">
              <span className="text-slate-400">Path NAS:</span>
              <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded truncate max-w-xs">
                {nasBrowsePath}
              </span>
              {nasBrowsePath !== '/' && (
                <button
                  onClick={() => {
                    const parent = nasBrowsePath.substring(0, nasBrowsePath.lastIndexOf('/')) || '/';
                    loadNasFolder(parent);
                  }}
                  className="ml-auto text-blue-400 hover:underline text-[11px]"
                >
                  &larr; Folder Atas
                </button>
              )}
            </div>

            {/* NAS Items list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 min-h-[250px]">
              {isLoadingNasItems ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                  <span className="text-xs">Memuat berkas dari NAS...</span>
                </div>
              ) : nasItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">Folder ini kosong di NAS</div>
              ) : (
                nasItems.map((item) => {
                  const isSelected = selectedNasPaths.has(item.path);
                  return (
                    <div
                      key={item.path}
                      onClick={() => handleToggleSelectNasItem(item.path)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors text-xs ${
                        isSelected
                          ? 'bg-blue-950/60 border-blue-500/60 text-white'
                          : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-3" />}
                        </div>

                        {item.isDir ? (
                          <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        )}
                        <span className="truncate font-medium">{item.name}</span>
                        {item.isDir && (
                          <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-1 rounded shrink-0">
                            Folder
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {item.isDir ? '' : formatBytes(item.size)}
                        </span>

                        {item.isDir && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadNasFolder(item.path);
                            }}
                            className="px-2 py-1 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] flex items-center gap-1 transition-colors"
                            title="Masuk ke dalam folder ini"
                          >
                            <span>Buka</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Terpilih: <strong className="text-white">
                  {nasItems.filter((i) => selectedNasPaths.has(i.path) && i.isDir).length > 0 &&
                    `${nasItems.filter((i) => selectedNasPaths.has(i.path) && i.isDir).length} folder, `}
                  {nasItems.filter((i) => selectedNasPaths.has(i.path) && !i.isDir).length} berkas
                </strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNasPickerModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmTransferToDrive}
                  disabled={selectedNasPaths.size === 0}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  <span>Transfer ke Google Drive</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE TRANSFER PROGRESS OVERLAY --- */}
      {(isTransferringToNas || isTransferringToDrive) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
              <ArrowRightLeft className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <h3 className="font-semibold text-white text-base">
                {isTransferringToNas ? 'Mentransfer ke Portal NAS' : 'Mentransfer ke Google Drive'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 truncate">
                Item {transferProgress.current} dari {transferProgress.total}:
              </p>
              <p className="text-xs font-medium text-blue-300 mt-0.5 truncate">{transferProgress.name}</p>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((transferProgress.current / Math.max(1, transferProgress.total)) * 100)}%`,
                }}
              />
            </div>

            <p className="text-[11px] text-slate-500">
              Mohon jangan menutup jendela ini hingga transfer selesai.
            </p>
          </div>
        </div>
      )}

      {/* --- CREATE NEW DRIVE FOLDER MODAL --- */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-semibold text-white text-base">Folder Baru di Google Drive</h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <input
                type="text"
                placeholder="Nama Folder"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  Buat Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MANDATORY DESTRUCTIVE ACTION CONFIRMATION MODAL --- */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-semibold text-white text-base">Hapus dari Google Drive?</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Apakah Anda yakin ingin menghapus &quot;<strong className="text-slate-200">{deleteConfirmItem.name}</strong>&quot; dari Google Drive?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteItem}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- IN-APP VIEWER MODAL FOR OFFICE, PDF, PHOTOS, VIDEOS --- */}
      {viewingDriveItem && (
        <DriveFileViewerModal
          item={viewingDriveItem}
          onClose={() => setViewingDriveItem(null)}
          onTransferToNas={(item) => handleStartTransferToNas([item])}
          showToast={showToast}
        />
      )}
    </div>
  );
};
