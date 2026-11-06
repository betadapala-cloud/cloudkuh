import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { FileExplorer } from './components/FileExplorer';
import { SyncHub } from './components/SyncHub';
import { NasPortalDirect } from './components/NasPortalDirect';
import { FilePreviewModal } from './components/FilePreviewModal';
import { PdfEditorModal } from './components/PdfEditorModal';
import { OfficeEditorModal } from './components/OfficeEditorModal';
import { NewFolderModal } from './components/NewFolderModal';
import { RenameModal } from './components/RenameModal';
import { DeleteModal } from './components/DeleteModal';
import { UploadProgressModal, UploadTask } from './components/UploadProgressModal';
import { MediaPlayer } from './components/MediaPlayer';
import { MiniPlayerBar } from './components/MiniPlayerBar';
import { AppLockScreen } from './components/AppLockScreen';
import { FileConflictModal } from './components/FileConflictModal';
import { GoogleDriveManager } from './components/GoogleDriveManager';
import { ActivityHistoryModal } from './components/ActivityHistoryModal';
import {
  saveAppStateToCloud,
  loadAppStateFromCloud,
  logActivityToCloud,
} from './services/firebase';
import {
  api,
  UploadController,
  createUploadController,
  UploadCancelledError,
} from './services/api';
import {
  NasFolderData,
  NasItem,
  NasStatus,
  SyncState,
  WebCredentials,
  ClipboardItem,
  UploadItemWithPath,
} from './types';
import { getFileCategory, isPdf, isOfficeFile, isOfficeOrPdf, formatBytes } from './utils/format';
import {
  CheckCircle2,
  AlertCircle,
  X,
  FolderSync,
  Shuffle,
  Folder,
  Globe,
  Menu,
  Upload,
  Plus,
  FolderUp,
  FileUp,
  FolderPlus,
} from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'files' | 'gdrive' | 'sync' | 'portal'>('files');
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [folderData, setFolderData] = useState<NasFolderData | null>(null);
  const [nasStatus, setNasStatus] = useState<NasStatus | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [credentials, setCredentials] = useState<WebCredentials | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isStateRestored, setIsStateRestored] = useState<boolean>(false);
  // App Lock Screen state (User: admin, Pass: djoko92m)
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    const auth = localStorage.getItem('cloudku_authenticated') || sessionStorage.getItem('cloudku_authenticated');
    return auth !== 'true';
  });

  const lastActivityTimeRef = useRef<number>(Date.now());

  const handleLockApp = (isAuto = false) => {
    localStorage.removeItem('cloudku_authenticated');
    sessionStorage.removeItem('cloudku_authenticated');
    setIsAppLocked(true);
    if (isAuto) {
      showToast('Aplikasi terkunci otomatis karena 5 menit tidak ada aktivitas', 'info');
    } else {
      showToast('Aplikasi telah dikunci untuk keamanan', 'info');
    }
  };

  // 5-Minute Inactivity Auto-Lock (Uploads and downloads continue running in background uninterrupted)
  useEffect(() => {
    const updateActivity = () => {
      lastActivityTimeRef.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((ev) => window.addEventListener(ev, updateActivity, { passive: true }));

    const timer = setInterval(() => {
      if (!isAppLocked) {
        const elapsed = Date.now() - lastActivityTimeRef.current;
        if (elapsed >= 5 * 60 * 1000) {
          handleLockApp(true);
        }
      }
    }, 5000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, updateActivity));
      clearInterval(timer);
    };
  }, [isAppLocked]);

  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  // Mobile upload menu sheet state
  const [isMobileUploadMenuOpen, setIsMobileUploadMenuOpen] = useState<boolean>(false);

  // Duplicate file upload conflict queue
  const [pendingConflicts, setPendingConflicts] = useState<{
    itemsToUpload: UploadItemWithPath[];
    conflicts: { uploadItem: UploadItemWithPath; existingItem: NasItem }[];
    currentConflictIndex: number;
    resolvedItems: UploadItemWithPath[];
  } | null>(null);

  // Multi-select state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Active clipboard for copy/move operations (supports multiple items)
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);

  // Upload progress tracking tasks
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);

  // Controllers for pause & cancel per upload task
  const uploadControllersRef = useRef<Map<string, UploadController>>(new Map());
  const uploadQueueRef = useRef<{
    isGlobalPaused: boolean;
    isGlobalCancelled: boolean;
  }>({
    isGlobalPaused: false,
    isGlobalCancelled: false,
  });
  const uploadItemsMapRef = useRef<
    Map<string, { item: UploadItemWithPath; targetDir: string }>
  >(new Map());

  // Media Player & Shuffle playback states
  const [activeMediaTrack, setActiveMediaTrack] = useState<NasItem | null>(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(true); // Shuffle is ON by default
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const [isMiniPlaying, setIsMiniPlaying] = useState<boolean>(true);

  // Modals for file operations
  const [previewItem, setPreviewItem] = useState<NasItem | null>(null);
  const [editingPdfItem, setEditingPdfItem] = useState<NasItem | null>(null);
  const [editingOfficeItem, setEditingOfficeItem] = useState<NasItem | null>(null);
  const [renamingItem, setRenamingItem] = useState<NasItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<NasItem | null>(null);
  const [deletingItems, setDeletingItems] = useState<NasItem[] | null>(null);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Initial load - Restore state from Cloud Firestore so reopening does not reset to root
  useEffect(() => {
    let active = true;

    const restoreCloudSession = async () => {
      try {
        const saved = await loadAppStateFromCloud();
        let targetPath = '/';
        if (saved && active) {
          if (saved.lastPath) {
            targetPath = saved.lastPath;
            setCurrentPath(saved.lastPath);
          }
          if (saved.activeTab) {
            setActiveTab(saved.activeTab);
          }
          if (saved.viewMode) {
            setViewMode(saved.viewMode);
          }
          if (saved.sortBy) {
            setSortBy(saved.sortBy);
          }
          if (typeof saved.sortAsc === 'boolean') {
            setSortAsc(saved.sortAsc);
          }
        }
        loadFiles(targetPath);
      } catch (err) {
        console.warn('Error loading session from Cloud Firestore:', err);
        loadFiles('/');
      } finally {
        if (active) {
          setIsStateRestored(true);
        }
      }
    };

    restoreCloudSession();
    loadStatus();
    loadSyncState();
    loadCredentials();

    // Setup Server-Sent Events (SSE) for live background updates
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/sync/events');
      eventSource.addEventListener('sync-event', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'sync' || payload.type === 'upload' || payload.type === 'delete') {
            loadFiles(currentPath);
            loadSyncState();
          }
        } catch {
          // Ignore parse errors
        }
      });
    } catch {
      // Fallback if SSE unavailable
    }

    return () => {
      active = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Persist user navigation and view state to Cloud Firestore
  useEffect(() => {
    if (!isStateRestored) return;
    const timer = setTimeout(() => {
      saveAppStateToCloud({
        lastPath: currentPath,
        activeTab,
        viewMode,
        sortBy,
        sortAsc,
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [currentPath, activeTab, viewMode, sortBy, sortAsc, isStateRestored]);

  // Poll NAS health periodically
  useEffect(() => {
    const interval = setInterval(() => {
      loadStatus(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async (showLoading = false) => {
    try {
      const status = await api.getStatus();
      setNasStatus(status);
    } catch {
      setNasStatus({
        success: false,
        nasHost: 'http://nas.e1cloud.biz.id:55582',
        user: 'joko92m',
        latencyMs: 0,
        authenticated: false,
        lastSyncCheck: Date.now(),
        autoSync: true,
        autoSyncInterval: 30000,
        deviceCount: 1,
        error: 'Tidak dapat menghubungi NAS',
      });
    }
  };

  const loadFiles = async (path: string) => {
    try {
      setIsLoading(true);
      const res = await api.getFiles(path);
      if (res.success && res.data) {
        setFolderData(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat berkas dari NAS', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSyncState = async () => {
    try {
      const state = await api.getSyncState();
      setSyncState(state);
    } catch {
      // silent fallback
    }
  };

  const loadCredentials = async () => {
    try {
      const creds = await api.getWebCredentials();
      setCredentials(creds);
    } catch {
      // silent fallback
    }
  };

  const handleNavigate = (path: string) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    setCurrentPath(cleanPath);
    setSelectedPaths(new Set()); // Reset selection on path change
    loadFiles(cleanPath);
  };

  // Selection handlers
  const handleToggleSelect = (item: NasItem) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(item.path)) {
        next.delete(item.path);
      } else {
        next.add(item.path);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const items = folderData?.items || [];
    const isAll = items.length > 0 && items.every((it) => selectedPaths.has(it.path));
    if (isAll) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(items.map((it) => it.path)));
    }
  };

  const handleClearSelection = () => {
    setSelectedPaths(new Set());
  };

  // Batch actions
  const handleBatchCopy = () => {
    const items = (folderData?.items || []).filter((it) => selectedPaths.has(it.path));
    if (items.length === 0) return;
    setClipboard({ action: 'copy', items });
    setSelectedPaths(new Set());
    showToast(`${items.length} item disalin ke papan klip. Buka folder tujuan lalu klik Tempel.`, 'info');
  };

  const handleBatchMove = () => {
    const items = (folderData?.items || []).filter((it) => selectedPaths.has(it.path));
    if (items.length === 0) return;
    setClipboard({ action: 'move', items });
    setSelectedPaths(new Set());
    showToast(`${items.length} item dipilih untuk dipindahkan. Buka folder tujuan lalu klik Tempel.`, 'info');
  };

  const handleBatchDelete = () => {
    const items = (folderData?.items || []).filter((it) => selectedPaths.has(it.path));
    if (items.length === 0) return;
    setDeletingItems(items);
  };

  // Media playlist for current folder
  const currentFolderMedia = (folderData?.items || []).filter(
    (it) =>
      !it.isDir &&
      (getFileCategory(it.extension, false) === 'video' ||
        getFileCategory(it.extension, false) === 'audio')
  );

  // Open item handler: If audio/video, open MediaPlayer; if PDF/Office, open editor; otherwise preview
  const handlePreviewOrPlay = (item: NasItem) => {
    const cat = getFileCategory(item.extension, false);
    if (cat === 'video' || cat === 'audio') {
      setActiveMediaTrack(item);
      setIsMediaModalOpen(true);
      setIsMiniPlaying(true);
    } else if (isPdf(item.extension)) {
      setEditingPdfItem(item);
    } else if (isOfficeFile(item.extension)) {
      setEditingOfficeItem(item);
    } else {
      setPreviewItem(item);
    }
  };

  // Dedicated document opening handler
  const handleOpenDocument = (item: NasItem) => {
    if (isPdf(item.extension)) {
      setEditingPdfItem(item);
    } else if (isOfficeFile(item.extension)) {
      setEditingOfficeItem(item);
    } else {
      setPreviewItem(item);
    }
  };

  // Shuffle play entire folder
  const handleShufflePlayFolder = () => {
    if (currentFolderMedia.length === 0) {
      showToast('Tidak ada video atau musik di dalam folder ini', 'info');
      return;
    }

    const randIdx = Math.floor(Math.random() * currentFolderMedia.length);
    const chosenTrack = currentFolderMedia[randIdx];
    setIsShuffle(true);
    setActiveMediaTrack(chosenTrack);
    setIsMediaModalOpen(true);
    setIsMiniPlaying(true);
    showToast(`Memutar acak: "${chosenTrack.name}"`, 'success');
  };

  // MiniPlayer next track
  const handleNextMedia = () => {
    if (currentFolderMedia.length <= 1 || !activeMediaTrack) return;
    const curIdx = currentFolderMedia.findIndex((t) => t.path === activeMediaTrack.path);

    if (isShuffle) {
      const candidates = currentFolderMedia
        .map((_, i) => i)
        .filter((i) => i !== curIdx);
      const randIdx = candidates[Math.floor(Math.random() * candidates.length)];
      setActiveMediaTrack(currentFolderMedia[randIdx]);
    } else {
      if (curIdx < currentFolderMedia.length - 1) {
        setActiveMediaTrack(currentFolderMedia[curIdx + 1]);
      } else {
        setActiveMediaTrack(currentFolderMedia[0]);
      }
    }
  };

  // MiniPlayer previous track
  const handlePrevMedia = () => {
    if (currentFolderMedia.length <= 1 || !activeMediaTrack) return;
    const curIdx = currentFolderMedia.findIndex((t) => t.path === activeMediaTrack.path);
    if (curIdx > 0) {
      setActiveMediaTrack(currentFolderMedia[curIdx - 1]);
    } else {
      setActiveMediaTrack(currentFolderMedia[currentFolderMedia.length - 1]);
    }
  };

  // Upload individual files handler with progress tracking
  const handleUploadFiles = async (files: FileList) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const uploadItems: UploadItemWithPath[] = fileArray.map((f) => ({
      file: f,
      relativePath: f.name,
    }));

    await handleUploadFolderFiles(uploadItems);
  };

  // Check for duplicate filenames before executing upload
  const handleUploadFolderFiles = async (uploadItems: UploadItemWithPath[]) => {
    if (!uploadItems || uploadItems.length === 0) return;

    const existingMap = new Map<string, NasItem>();
    (folderData?.items || []).forEach((it) => {
      existingMap.set(it.name.toLowerCase(), it);
    });

    const conflicts: { uploadItem: UploadItemWithPath; existingItem: NasItem }[] = [];
    const nonConflicts: UploadItemWithPath[] = [];

    for (const item of uploadItems) {
      const parts = item.relativePath.split('/').filter(Boolean);
      const isDirectChild = parts.length <= 1;

      if (isDirectChild && existingMap.has(item.file.name.toLowerCase())) {
        conflicts.push({
          uploadItem: item,
          existingItem: existingMap.get(item.file.name.toLowerCase())!,
        });
      } else {
        nonConflicts.push(item);
      }
    }

    if (conflicts.length > 0) {
      // Prompt user with Conflict Resolution Modal
      setPendingConflicts({
        itemsToUpload: uploadItems,
        conflicts,
        currentConflictIndex: 0,
        resolvedItems: nonConflicts,
      });
    } else {
      await executeUploadFolderFiles(uploadItems);
    }
  };

  const handleResolveConflict = async (action: 'overwrite' | 'skip' | 'rename', applyToAll: boolean) => {
    if (!pendingConflicts) return;

    const { conflicts, currentConflictIndex, resolvedItems } = pendingConflicts;
    const current = conflicts[currentConflictIndex];

    const processItem = (
      c: { uploadItem: UploadItemWithPath; existingItem: NasItem },
      act: 'overwrite' | 'skip' | 'rename'
    ): UploadItemWithPath | null => {
      if (act === 'skip') {
        return null;
      }
      if (act === 'rename') {
        const originalName = c.uploadItem.file.name;
        const lastDot = originalName.lastIndexOf('.');
        const base = lastDot !== -1 ? originalName.slice(0, lastDot) : originalName;
        const ext = lastDot !== -1 ? originalName.slice(lastDot) : '';
        const newName = `${base} (1)${ext}`;

        const renamedFile = new File([c.uploadItem.file], newName, { type: c.uploadItem.file.type });
        return {
          file: renamedFile,
          relativePath: newName,
        };
      }
      // 'overwrite'
      return c.uploadItem;
    };

    if (applyToAll) {
      const newResolved = [...resolvedItems];
      for (let i = currentConflictIndex; i < conflicts.length; i++) {
        const res = processItem(conflicts[i], action);
        if (res) newResolved.push(res);
      }
      setPendingConflicts(null);
      if (newResolved.length > 0) {
        await executeUploadFolderFiles(newResolved);
      } else {
        showToast('Semua berkas yang sama dilewati', 'info');
      }
    } else {
      const res = processItem(current, action);
      const newResolved = res ? [...resolvedItems, res] : [...resolvedItems];
      const nextIndex = currentConflictIndex + 1;

      if (nextIndex < conflicts.length) {
        setPendingConflicts({
          ...pendingConflicts,
          currentConflictIndex: nextIndex,
          resolvedItems: newResolved,
        });
      } else {
        setPendingConflicts(null);
        if (newResolved.length > 0) {
          await executeUploadFolderFiles(newResolved);
        } else {
          showToast('Semua berkas yang sama dilewati', 'info');
        }
      }
    }
  };

  const handleCancelAllConflicts = () => {
    setPendingConflicts(null);
    showToast('Proses unggah berkas dibatalkan', 'info');
  };

  // Upload files with folder structure preserved (e.g. from folder input or desktop drag-drop)
  const executeUploadFolderFiles = async (uploadItems: UploadItemWithPath[]) => {
    if (!uploadItems || uploadItems.length === 0) return;

    const cleanBaseDir = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;

    // 1. Collect all distinct subdirectories needed
    const subDirsSet = new Set<string>();
    for (const item of uploadItems) {
      const parts = item.relativePath.split('/').filter(Boolean);
      if (parts.length > 1) {
        parts.pop(); // Remove file name
        let accumulated = '';
        for (const p of parts) {
          accumulated = accumulated ? `${accumulated}/${p}` : p;
          subDirsSet.add(accumulated);
        }
      }
    }

    // Sort subdirectories by depth so parents are created first
    const sortedSubDirs = Array.from(subDirsSet).sort(
      (a, b) => a.split('/').length - b.split('/').length
    );

    // Create subdirectories on NAS
    for (const subDir of sortedSubDirs) {
      const fullDirToCreate = `${cleanBaseDir}${subDir}/`;
      try {
        await api.createFolder(fullDirToCreate);
      } catch {
        // Folder might already exist, continue
      }
    }

    // 2. Build task queue for modal and register controllers
    uploadQueueRef.current = { isGlobalPaused: false, isGlobalCancelled: false };

    const newTasks: UploadTask[] = uploadItems.map((item, idx) => {
      const taskId = `task-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
      const controller = createUploadController();
      uploadControllersRef.current.set(taskId, controller);

      const parts = item.relativePath.split('/').filter(Boolean);
      let targetDir = cleanBaseDir;
      if (parts.length > 1) {
        parts.pop();
        targetDir = `${cleanBaseDir}${parts.join('/')}`;
      }
      uploadItemsMapRef.current.set(taskId, { item, targetDir });

      return {
        id: taskId,
        name: item.file.name,
        relativePath: item.relativePath,
        size: item.file.size,
        loaded: 0,
        percentage: 0,
        status: 'pending',
      };
    });

    setUploadTasks((prev) => [...prev, ...newTasks]);

    let successCount = 0;

    // 3. Upload files sequentially with pause & cancel checks
    for (let i = 0; i < newTasks.length; i++) {
      const taskId = newTasks[i].id;
      const meta = uploadItemsMapRef.current.get(taskId);
      const controller = uploadControllersRef.current.get(taskId);

      if (!meta || !controller) continue;
      const { item, targetDir } = meta;

      // Check global cancel or task cancel
      if (uploadQueueRef.current.isGlobalCancelled || controller.isCancelled()) {
        setUploadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId && t.status !== 'completed' ? { ...t, status: 'cancelled' } : t
          )
        );
        continue;
      }

      // Check global pause or task pause before starting
      while (uploadQueueRef.current.isGlobalPaused || controller.isPaused()) {
        if (uploadQueueRef.current.isGlobalCancelled || controller.isCancelled()) {
          break;
        }
        setUploadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId && t.status !== 'completed' ? { ...t, status: 'paused' } : t
          )
        );
        await new Promise((r) => setTimeout(r, 400));
      }

      if (uploadQueueRef.current.isGlobalCancelled || controller.isCancelled()) {
        setUploadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId && t.status !== 'completed' ? { ...t, status: 'cancelled' } : t
          )
        );
        continue;
      }

      setUploadTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'uploading' } : t))
      );

      try {
        await api.uploadFile(
          targetDir,
          item.file,
          (progress) => {
            setUploadTasks((prev) =>
              prev.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      loaded: progress.loaded,
                      percentage: progress.percentage,
                    }
                  : t
              )
            );
          },
          controller
        );

        setUploadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  loaded: item.file.size,
                  percentage: 100,
                  status: 'completed',
                }
              : t
          )
        );
        successCount++;
        logActivityToCloud({
          actionType: 'upload',
          title: `Unggah berkas "${item.file.name}"`,
          details: `Ukuran: ${formatBytes(item.file.size)}, Lokasi: ${targetDir}`,
          path: `${targetDir}${item.file.name}`,
          status: 'success',
        });
      } catch (err: any) {
        if (err instanceof UploadCancelledError || controller.isCancelled()) {
          setUploadTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: 'cancelled' } : t))
          );
        } else {
          setUploadTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    status: 'error',
                    error: err.message || 'Gagal mengunggah',
                  }
                : t
            )
          );
          showToast(`Gagal mengunggah ${item.file.name}: ${err.message}`, 'error');
        }
      }
    }

    if (successCount > 0) {
      logActivityToCloud({
        actionType: 'upload',
        title: `Selesai unggah ${successCount} berkas ke Home Server`,
        details: `Direktori: ${cleanBaseDir}`,
        path: cleanBaseDir,
        itemCount: successCount,
        status: 'success',
      });
      showToast(`${successCount} berkas berhasil diunggah ke NAS`, 'success');
      loadFiles(currentPath);
    }
  };

  // Pause single task
  const handlePauseTask = (taskId: string) => {
    const controller = uploadControllersRef.current.get(taskId);
    if (controller) {
      controller.pause();
    }
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === taskId && (t.status === 'uploading' || t.status === 'pending')
          ? { ...t, status: 'paused' }
          : t
      )
    );
    showToast('Unggahan berkas dijeda', 'info');
  };

  // Resume single task
  const handleResumeTask = (taskId: string) => {
    const controller = uploadControllersRef.current.get(taskId);
    if (controller) {
      controller.resume();
    }
    setUploadTasks((prev) =>
      prev.map((t) => (t.id === taskId && t.status === 'paused' ? { ...t, status: 'uploading' } : t))
    );
    showToast('Melanjutkan unggahan berkas...', 'info');
  };

  // Cancel single task
  const handleCancelTask = (taskId: string) => {
    const controller = uploadControllersRef.current.get(taskId);
    if (controller) {
      controller.cancel();
    }
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === taskId && t.status !== 'completed' ? { ...t, status: 'cancelled' } : t
      )
    );
    showToast('Unggahan berkas dibatalkan', 'info');
  };

  // Pause all tasks
  const handlePauseAll = () => {
    uploadQueueRef.current.isGlobalPaused = true;
    uploadControllersRef.current.forEach((ctrl) => ctrl.pause());
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.status === 'uploading' || t.status === 'pending' ? { ...t, status: 'paused' } : t
      )
    );
    showToast('Semua unggahan dijeda', 'info');
  };

  // Resume all tasks
  const handleResumeAll = () => {
    uploadQueueRef.current.isGlobalPaused = false;
    uploadControllersRef.current.forEach((ctrl) => ctrl.resume());
    setUploadTasks((prev) =>
      prev.map((t) => (t.status === 'paused' ? { ...t, status: 'uploading' } : t))
    );
    showToast('Melanjutkan semua unggahan...', 'info');
  };

  // Cancel all tasks
  const handleCancelAll = () => {
    uploadQueueRef.current.isGlobalCancelled = true;
    uploadControllersRef.current.forEach((ctrl) => ctrl.cancel());
    setUploadTasks((prev) =>
      prev.map((t) => (t.status !== 'completed' ? { ...t, status: 'cancelled' } : t))
    );
    showToast('Semua proses unggahan dibatalkan', 'info');
  };

  // Retry a cancelled or failed task
  const handleRetryTask = async (taskId: string) => {
    const meta = uploadItemsMapRef.current.get(taskId);
    if (!meta) return;

    const newController = createUploadController();
    uploadControllersRef.current.set(taskId, newController);

    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: 'uploading', loaded: 0, percentage: 0, error: undefined }
          : t
      )
    );

    try {
      await api.uploadFile(
        meta.targetDir,
        meta.item.file,
        (progress) => {
          setUploadTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, loaded: progress.loaded, percentage: progress.percentage }
                : t
            )
          );
        },
        newController
      );

      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: 'completed', loaded: meta.item.file.size, percentage: 100 }
            : t
        )
      );
      showToast(`Berkas "${meta.item.file.name}" berhasil diunggah`, 'success');
      loadFiles(currentPath);
    } catch (err: any) {
      if (err instanceof UploadCancelledError || newController.isCancelled()) {
        setUploadTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: 'cancelled' } : t))
        );
      } else {
        setUploadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: 'error', error: err.message || 'Gagal' } : t
          )
        );
        showToast(`Gagal mengulang unggah "${meta.item.file.name}": ${err.message}`, 'error');
      }
    }
  };

  // Folder input change handler
  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const items: UploadItemWithPath[] = Array.from(e.target.files).map((f) => ({
        file: f,
        relativePath: (f as any).webkitRelativePath || f.name,
      }));
      handleUploadFolderFiles(items);
      e.target.value = '';
    }
  };

  // Create folder handler
  const handleCreateFolder = async (folderName: string) => {
    const cleanDir = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
    const newPath = `${cleanDir}${folderName}/`;
    await api.createFolder(newPath);
    await logActivityToCloud({
      actionType: 'create_folder',
      title: `Membuat folder "${folderName}"`,
      path: newPath,
      status: 'success',
    });
    showToast(`Folder "${folderName}" berhasil dibuat`, 'success');
    loadFiles(currentPath);
  };

  // Rename item handler
  const handleRename = async (sourcePath: string, newName: string) => {
    const dir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    const isDir = sourcePath.endsWith('/');
    const dest = `${dir}/${newName}${isDir ? '/' : ''}`;
    await api.renameItem(sourcePath, dest);
    await logActivityToCloud({
      actionType: 'rename',
      title: `Mengubah nama berkas/folder menjadi "${newName}"`,
      details: `${sourcePath} -> ${dest}`,
      path: dest,
      status: 'success',
    });
    showToast(`Nama berhasil diubah menjadi "${newName}"`, 'success');
    loadFiles(currentPath);
  };

  // Delete item or multiple items handler
  const handleDelete = async (target: NasItem | NasItem[]) => {
    if (Array.isArray(target)) {
      let deletedCount = 0;
      for (const it of target) {
        try {
          await api.deleteItem(it.path);
          deletedCount++;
        } catch (err: any) {
          showToast(`Gagal menghapus "${it.name}": ${err.message}`, 'error');
        }
      }
      await logActivityToCloud({
        actionType: 'delete',
        title: `Menghapus ${deletedCount} item`,
        details: target.map((i) => i.name).join(', '),
        path: currentPath,
        itemCount: deletedCount,
        status: 'success',
      });
      showToast(`${deletedCount} item berhasil dihapus`, 'success');
      setSelectedPaths(new Set());
    } else {
      await api.deleteItem(target.path);
      await logActivityToCloud({
        actionType: 'delete',
        title: `Menghapus "${target.name}"`,
        path: target.path,
        status: 'success',
      });
      showToast(`"${target.name}" berhasil dihapus`, 'success');
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        next.delete(target.path);
        return next;
      });
    }
    loadFiles(currentPath);
  };

  // Download item handler (supports large video streaming and direct NAS download)
  const handleDownload = async (item: NasItem) => {
    const isVideo = getFileCategory(item.extension, false) === 'video';

    // If large video (> 100 MB), use direct NAS link to ensure zero 500/timeout errors
    if (isVideo && item.size > 100 * 1024 * 1024) {
      showToast(`Mengunduh video besar "${item.name}"...`, 'info');
      try {
        const directUrl = await api.getDirectDownloadUrl(item.path);
        const link = document.createElement('a');
        link.href = directUrl;
        link.setAttribute('download', item.name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      } catch {
        // Fallback to proxy
      }
    }

    const url = api.getRawFileUrl(item.path, true);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', item.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Mengunduh "${item.name}"...`, 'info');
  };

  // Single item copy to clipboard
  const handleCopyItem = (item: NasItem) => {
    setClipboard({ action: 'copy', items: [item] });
    showToast(`"${item.name}" disalin ke papan klip. Buka folder tujuan lalu klik Tempel.`, 'info');
  };

  // Single item move to clipboard
  const handleMoveItem = (item: NasItem) => {
    setClipboard({ action: 'move', items: [item] });
    showToast(`"${item.name}" dipilih untuk dipindahkan. Buka folder tujuan lalu klik Tempel.`, 'info');
  };

  // Clear clipboard
  const handleClearClipboard = () => {
    setClipboard(null);
    showToast('Papan klip dibatalkan', 'info');
  };

  // Paste items from clipboard to current directory
  const handlePaste = async () => {
    if (!clipboard || !clipboard.items || clipboard.items.length === 0) return;
    const { action, items } = clipboard;
    const cleanDir = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;

    let successCount = 0;
    for (const it of items) {
      const destinationPath = `${cleanDir}${it.name}${it.isDir ? '/' : ''}`;

      if (it.path === destinationPath) {
        continue;
      }

      try {
        if (action === 'copy') {
          await api.copyItem(it.path, destinationPath);
        } else {
          await api.moveItem(it.path, destinationPath);
        }
        successCount++;
      } catch (err: any) {
        showToast(
          `Gagal ${action === 'copy' ? 'menyalin' : 'memindahkan'} "${it.name}": ${err.message}`,
          'error'
        );
      }
    }

    if (successCount > 0) {
      await logActivityToCloud({
        actionType: action === 'copy' ? 'copy' : 'move',
        title: `${action === 'copy' ? 'Menyalin' : 'Memindahkan'} ${successCount} item ke "${cleanDir}"`,
        path: cleanDir,
        itemCount: successCount,
        status: 'success',
      });
      showToast(
        `${successCount} item berhasil ${action === 'copy' ? 'disalin' : 'dipindahkan'} ke folder ini`,
        'success'
      );
      if (action === 'move') {
        setClipboard(null);
      }
      loadFiles(currentPath);
    }
  };

  // Move items to a specific target folder (Internal Drag-and-Drop)
  const handleMoveItemsToFolder = async (itemsToMove: NasItem[], targetFolder: NasItem) => {
    if (!itemsToMove || itemsToMove.length === 0) return;
    const cleanTargetDir = targetFolder.path.endsWith('/') ? targetFolder.path : `${targetFolder.path}/`;

    let movedCount = 0;
    for (const it of itemsToMove) {
      // Disallow moving a folder into itself
      if (it.path === targetFolder.path) continue;
      const destinationPath = `${cleanTargetDir}${it.name}${it.isDir ? '/' : ''}`;
      try {
        await api.moveItem(it.path, destinationPath);
        movedCount++;
      } catch (err: any) {
        showToast(`Gagal memindahkan "${it.name}": ${err.message}`, 'error');
      }
    }

    if (movedCount > 0) {
      await logActivityToCloud({
        actionType: 'move',
        title: `Memindahkan ${movedCount} item ke folder "${targetFolder.name}"`,
        path: cleanTargetDir,
        itemCount: movedCount,
        status: 'success',
      });
      showToast(
        `${movedCount} item berhasil dipindahkan ke folder "${targetFolder.name}"`,
        'success'
      );
      setSelectedPaths(new Set());
      loadFiles(currentPath);
    }
  };

  // Trigger manual sync
  const handleTriggerSync = async () => {
    try {
      setIsSyncing(true);
      await api.triggerSync(currentPath);
      const updatedState = await api.getSyncState();
      setSyncState(updatedState);
      await logActivityToCloud({
        actionType: 'sync',
        title: 'Sinkronisasi instan real-time dengan Home Server',
        path: currentPath,
        status: 'success',
      });
      showToast('Sinkronisasi instan antar perangkat berhasil diselesaikan', 'success');
      loadFiles(currentPath);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyinkronkan', 'error');
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  // Toggle auto sync
  const handleToggleAutoSync = async (enabled: boolean, intervalMs?: number) => {
    try {
      await api.toggleAutoSync(enabled, intervalMs);
      setSyncState((prev) =>
        prev ? { ...prev, autoSync: enabled, intervalMs: intervalMs || prev.intervalMs } : null
      );
      showToast(
        enabled ? 'Sinkronisasi otomatis diaktifkan' : 'Sinkronisasi otomatis dijeda',
        'info'
      );
    } catch {
      showToast('Gagal mengubah pengaturan sinkronisasi', 'error');
    }
  };

  // Remove device
  const handleRemoveDevice = async (id: string) => {
    await api.removeDevice(id);
    const updatedState = await api.getSyncState();
    setSyncState(updatedState);
    showToast('Perangkat berhasil diputus', 'info');
  };

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-slate-900 text-slate-100 font-sans antialiased">
      {/* Hidden file input for upload button */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleUploadFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Hidden folder input for directory upload */}
      <input
        type="file"
        ref={folderInputRef}
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
        className="hidden"
        onChange={handleFolderInputChange}
      />

      {/* Sidebar (Desktop and Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        nasStatus={nasStatus}
        syncState={syncState}
        currentPath={currentPath}
        onNavigate={handleNavigate}
        isSyncing={isSyncing}
        onTriggerSync={handleTriggerSync}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        onLockApp={handleLockApp}
        onOpenActivityHistory={() => setIsHistoryModalOpen(true)}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
        {/* Top Navigation Bar */}
        <Navbar
          currentPath={currentPath}
          onNavigate={handleNavigate}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortAsc={sortAsc}
          setSortAsc={setSortAsc}
          onUploadClick={() => fileInputRef.current?.click()}
          onUploadFolderClick={() => folderInputRef.current?.click()}
          onNewFolderClick={() => setIsNewFolderOpen(true)}
          onRefresh={() => loadFiles(currentPath)}
          onTriggerSync={handleTriggerSync}
          isSyncing={isSyncing}
          isLoading={isLoading}
          clipboard={clipboard}
          onPasteClick={handlePaste}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          onLockApp={handleLockApp}
          onOpenActivityHistory={() => setIsHistoryModalOpen(true)}
        />

        {/* Tab Views */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
          {activeTab === 'files' && (
            <FileExplorer
              currentPath={currentPath}
              folderData={folderData}
              isLoading={isLoading}
              searchQuery={searchQuery}
              viewMode={viewMode}
              sortBy={sortBy}
              sortAsc={sortAsc}
              clipboard={clipboard}
              selectedPaths={selectedPaths}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              onBatchCopy={handleBatchCopy}
              onBatchMove={handleBatchMove}
              onBatchDelete={handleBatchDelete}
              onNavigate={handleNavigate}
              onPreview={handlePreviewOrPlay}
              onEditDocument={handleOpenDocument}
              onDownload={handleDownload}
              onRename={setRenamingItem}
              onDelete={setDeletingItem}
              onUploadFiles={handleUploadFiles}
              onUploadFolderFiles={handleUploadFolderFiles}
              onNewFolder={() => setIsNewFolderOpen(true)}
              onShufflePlayFolder={handleShufflePlayFolder}
              onCopyItem={handleCopyItem}
              onMoveItem={handleMoveItem}
              onMoveItemsToFolder={handleMoveItemsToFolder}
              onPaste={handlePaste}
              onClearClipboard={handleClearClipboard}
            />
          )}

          {activeTab === 'gdrive' && (
            <GoogleDriveManager
              currentNasPath={currentPath}
              onRefreshNasFiles={() => loadFiles(currentPath)}
              showToast={showToast}
            />
          )}

          {activeTab === 'sync' && (
            <SyncHub
              syncState={syncState}
              nasStatus={nasStatus}
              onToggleAutoSync={handleToggleAutoSync}
              onTriggerSync={handleTriggerSync}
              isSyncing={isSyncing}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'portal' && (
            <NasPortalDirect nasStatus={nasStatus} credentials={credentials} />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar: includes Menu, Unggah, Home Server, Google Drive, Sinkron, and Portal NAS */}
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md px-2 py-2 flex items-center justify-around shadow-2xl safe-area-pb"
        >
          {/* 1. Home Server */}
          <button
            onClick={() => {
              setActiveTab('files');
              handleNavigate('/');
            }}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'files'
                ? 'text-blue-400 font-semibold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            <span className="text-[9px] sm:text-[10px] truncate max-w-[65px]">Home Server</span>
          </button>

          {/* 2. Menu Button (Toggles Mobile Sidebar Drawer) */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            title="Buka Menu"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            <span className="text-[9px] sm:text-[10px]">Menu</span>
          </button>

          {/* 3. Unggah Berkas / Folder Center Action Button */}
          <button
            onClick={() => setIsMobileUploadMenuOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-md active:scale-95 cursor-pointer -mt-2 border-2 border-slate-900"
            title="Unggah Berkas atau Folder"
          >
            <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[9px] sm:text-[10px]">Unggah</span>
          </button>

          {/* 4. Google Drive Tab (2-way sync) */}
          <button
            onClick={() => setActiveTab('gdrive')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'gdrive'
                ? 'text-blue-400 font-semibold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Google Drive"
          >
            <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>
            <span className="text-[9px] sm:text-[10px] truncate max-w-[50px]">Drive</span>
          </button>

          {/* 5. Sinkron */}
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all relative cursor-pointer ${
              activeTab === 'sync'
                ? 'text-blue-400 font-semibold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <FolderSync className={`w-4 h-4 sm:w-5 sm:h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
            </div>
            <span className="text-[9px] sm:text-[10px]">Sinkron</span>
          </button>

          {/* 6. Portal NAS */}
          <button
            onClick={() => setActiveTab('portal')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'portal'
                ? 'text-blue-400 font-semibold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            <span className="text-[9px] sm:text-[10px] truncate max-w-[50px]">Portal</span>
          </button>
        </nav>
      </div>

      {/* Mobile Upload Action Sheet */}
      {isMobileUploadMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end animate-in fade-in duration-150">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setIsMobileUploadMenuOpen(false)}
          />
          <div className="relative bg-slate-900 border-t border-slate-800 rounded-t-2xl p-5 shadow-2xl z-10 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto" />
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm">Unggah ke Portal NAS</h3>
                <p className="text-[11px] text-slate-400 font-mono truncate max-w-[250px]">
                  Direktori tujuan: {currentPath}
                </p>
              </div>
              <button
                onClick={() => setIsMobileUploadMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setIsMobileUploadMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 active:scale-98 transition-all cursor-pointer text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <FileUp className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-200">Unggah Berkas</span>
                <span className="text-[10px] text-slate-400">Foto, video, audio, dokumen</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileUploadMenuOpen(false);
                  folderInputRef.current?.click();
                }}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 active:scale-98 transition-all cursor-pointer text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FolderUp className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-200">Unggah Folder</span>
                <span className="text-[10px] text-slate-400">Direktori utuh bersarang</span>
              </button>
            </div>

            <button
              onClick={() => {
                setIsMobileUploadMenuOpen(false);
                setIsNewFolderOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-amber-400" />
              <span>Buat Folder Baru di Direktori Ini</span>
            </button>
          </div>
        </div>
      )}

      {/* Dedicated Shuffle Media Player Modal (for Video & Music) */}
      {isMediaModalOpen && activeMediaTrack && (
        <MediaPlayer
          currentTrack={activeMediaTrack}
          playlist={currentFolderMedia}
          onSelectTrack={setActiveMediaTrack}
          onClose={() => setIsMediaModalOpen(false)}
          isShuffle={isShuffle}
          onToggleShuffle={() => {
            setIsShuffle(!isShuffle);
            showToast(!isShuffle ? 'Mode acak diaktifkan' : 'Mode acak dinonaktifkan', 'info');
          }}
          repeatMode={repeatMode}
          onCycleRepeatMode={() => {
            const nextMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
            setRepeatMode(nextMode);
          }}
          onDownload={handleDownload}
        />
      )}

      {/* Floating Bottom Mini Player Bar */}
      {!isMediaModalOpen && activeMediaTrack && (
        <MiniPlayerBar
          currentTrack={activeMediaTrack}
          isPlaying={isMiniPlaying}
          onTogglePlay={() => setIsMiniPlaying(!isMiniPlaying)}
          onNext={handleNextMedia}
          onPrev={handlePrevMedia}
          isShuffle={isShuffle}
          onToggleShuffle={() => {
            setIsShuffle(!isShuffle);
            showToast(!isShuffle ? 'Mode acak diaktifkan' : 'Mode acak dinonaktifkan', 'info');
          }}
          onExpand={() => setIsMediaModalOpen(true)}
          onStop={() => setActiveMediaTrack(null)}
        />
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        item={previewItem}
        allItems={folderData?.items || []}
        onSelectItem={setPreviewItem}
        onClose={() => setPreviewItem(null)}
        onDownload={handleDownload}
      />

      {/* PDF Viewer & Annotation Editor Modal */}
      {editingPdfItem && (
        <PdfEditorModal
          item={editingPdfItem}
          onClose={() => setEditingPdfItem(null)}
          onSaved={() => {
            showToast(`Perubahan PDF "${editingPdfItem.name}" berhasil disimpan ke NAS`, 'success');
            loadFiles(currentPath);
          }}
        />
      )}

      {/* Office Document & Spreadsheet Editor Modal */}
      {editingOfficeItem && (
        <OfficeEditorModal
          item={editingOfficeItem}
          onClose={() => setEditingOfficeItem(null)}
          onSaved={() => {
            showToast(`Dokumen "${editingOfficeItem.name}" berhasil disimpan ke NAS`, 'success');
            loadFiles(currentPath);
          }}
        />
      )}

      {/* Upload Progress Drawer / Modal with Pause, Resume, Cancel, and Retry */}
      <UploadProgressModal
        tasks={uploadTasks}
        onDismiss={() => setUploadTasks([])}
        onClearCompleted={() =>
          setUploadTasks((prev) =>
            prev.filter(
              (t) => t.status === 'uploading' || t.status === 'pending' || t.status === 'paused'
            )
          )
        }
        onPauseTask={handlePauseTask}
        onResumeTask={handleResumeTask}
        onCancelTask={handleCancelTask}
        onPauseAll={handlePauseAll}
        onResumeAll={handleResumeAll}
        onCancelAll={handleCancelAll}
        onRetryTask={handleRetryTask}
      />

      <NewFolderModal
        isOpen={isNewFolderOpen}
        currentPath={currentPath}
        onClose={() => setIsNewFolderOpen(false)}
        onCreate={handleCreateFolder}
      />

      <RenameModal
        item={renamingItem}
        onClose={() => setRenamingItem(null)}
        onRename={handleRename}
      />

      {/* Delete Confirmation Modal (Handles single item or multiple selected items) */}
      <DeleteModal
        item={deletingItem}
        items={deletingItems}
        onClose={() => {
          setDeletingItem(null);
          setDeletingItems(null);
        }}
        onConfirm={handleDelete}
      />

      {/* Duplicate File Upload Conflict Warning Modal */}
      {pendingConflicts && pendingConflicts.conflicts[pendingConflicts.currentConflictIndex] && (
        <FileConflictModal
          conflict={pendingConflicts.conflicts[pendingConflicts.currentConflictIndex]}
          remainingConflictsCount={pendingConflicts.conflicts.length - pendingConflicts.currentConflictIndex}
          onResolve={handleResolveConflict}
          onCancelAll={handleCancelAllConflicts}
        />
      )}

      {/* App Startup / Security Lock Screen Modal */}
      {isAppLocked && (
        <AppLockScreen
          onUnlock={() => {
            setIsAppLocked(false);
            logActivityToCloud({
              actionType: 'login',
              title: 'Membuka kunci aplikasi CloudKu',
              status: 'success',
            });
          }}
          activeUploadsCount={uploadTasks.filter((t) => t.status === 'uploading' || t.status === 'pending').length}
        />
      )}

      {/* Cloud Firestore Activity History Modal */}
      <ActivityHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* Toast Notifications */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-2 ${
              toast.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/40 text-emerald-300'
                : toast.type === 'error'
                ? 'bg-slate-900/95 border-rose-500/40 text-rose-300'
                : 'bg-slate-900/95 border-blue-500/40 text-blue-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <FolderSync className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            )}
            <span className="text-xs font-medium flex-1 text-slate-200">{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
