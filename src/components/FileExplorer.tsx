import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  Shuffle,
  ClipboardPaste,
  X,
  Copy,
  FolderInput,
  CheckSquare,
  Square,
  Trash2,
  Folder,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Music,
  Layers,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { NasFolderData, NasItem, ClipboardItem, UploadItemWithPath } from '../types';
import { FileCard } from './FileCard';
import { FileRow } from './FileRow';
import { formatBytes, getFileCategory, isOfficeOrPdf } from '../utils/format';

export type CategoryFilterType = 'all' | 'image' | 'video' | 'document' | 'audio' | 'folder';

interface FileExplorerProps {
  currentPath: string;
  folderData: NasFolderData | null;
  isLoading: boolean;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'size' | 'modified';
  sortAsc: boolean;
  clipboard: ClipboardItem | null;
  selectedPaths: Set<string>;
  onToggleSelect: (item: NasItem) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchCopy: () => void;
  onBatchMove: () => void;
  onBatchDelete: () => void;
  onNavigate: (path: string) => void;
  onPreview: (item: NasItem) => void;
  onEditDocument?: (item: NasItem) => void;
  onDownload: (item: NasItem) => void;
  onRename: (item: NasItem) => void;
  onDelete: (item: NasItem) => void;
  onUploadFiles: (files: FileList) => void;
  onUploadFolderFiles: (items: UploadItemWithPath[]) => void;
  onNewFolder: () => void;
  onShufflePlayFolder?: () => void;
  onCopyItem: (item: NasItem) => void;
  onMoveItem: (item: NasItem) => void;
  onMoveItemsToFolder: (itemsToMove: NasItem[], targetFolder: NasItem) => void;
  onPaste: () => void;
  onClearClipboard: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  currentPath,
  folderData,
  isLoading,
  searchQuery,
  viewMode,
  sortBy,
  sortAsc,
  clipboard,
  selectedPaths,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchCopy,
  onBatchMove,
  onBatchDelete,
  onNavigate,
  onPreview,
  onEditDocument,
  onDownload,
  onRename,
  onDelete,
  onUploadFiles,
  onUploadFolderFiles,
  onNewFolder,
  onShufflePlayFolder,
  onCopyItem,
  onMoveItem,
  onMoveItemsToFolder,
  onPaste,
  onClearClipboard,
}) => {
  const [isDraggingDesktop, setIsDraggingDesktop] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>('all');
  const [isGroupedView, setIsGroupedView] = useState<boolean>(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop > 120) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  };

  const handleScrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };


  // Filter items based on search query
  const items = folderData?.items || [];
  const searchFilteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Compute live counts per category for the current folder
  const folderCount = searchFilteredItems.filter((it) => it.isDir).length;
  const imageCount = searchFilteredItems.filter(
    (it) => !it.isDir && getFileCategory(it.extension, false) === 'image'
  ).length;
  const videoCount = searchFilteredItems.filter(
    (it) => !it.isDir && getFileCategory(it.extension, false) === 'video'
  ).length;
  const docCount = searchFilteredItems.filter(
    (it) => !it.isDir && (getFileCategory(it.extension, false) === 'document' || isOfficeOrPdf(it.extension))
  ).length;
  const audioCount = searchFilteredItems.filter(
    (it) => !it.isDir && getFileCategory(it.extension, false) === 'audio'
  ).length;

  // Filter items by active category pill
  const filteredItems = searchFilteredItems.filter((item) => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'folder') return item.isDir;
    if (item.isDir) return false;
    const cat = getFileCategory(item.extension, false);
    if (categoryFilter === 'document') {
      return cat === 'document' || isOfficeOrPdf(item.extension);
    }
    return cat === categoryFilter;
  });

  // Sort items: folders first (unless sorting specifically), then by chosen criterion
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!isGroupedView) {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
    }

    let comp = 0;
    if (sortBy === 'name') {
      comp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortBy === 'size') {
      comp = a.size - b.size;
    } else if (sortBy === 'modified') {
      comp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
    }
    return sortAsc ? comp : -comp;
  });

  // Categories for grouped view
  const groupedSections = [
    {
      id: 'folder',
      title: 'Folder Direktori',
      icon: Folder,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      items: sortedItems.filter((it) => it.isDir),
    },
    {
      id: 'image',
      title: 'Foto & Gambar',
      icon: ImageIcon,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      items: sortedItems.filter((it) => !it.isDir && getFileCategory(it.extension, false) === 'image'),
    },
    {
      id: 'video',
      title: 'Video & Film',
      icon: VideoIcon,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
      items: sortedItems.filter((it) => !it.isDir && getFileCategory(it.extension, false) === 'video'),
    },
    {
      id: 'document',
      title: 'Dokumen & PDF',
      icon: FileText,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      items: sortedItems.filter(
        (it) => !it.isDir && (getFileCategory(it.extension, false) === 'document' || isOfficeOrPdf(it.extension))
      ),
    },
    {
      id: 'audio',
      title: 'Musik & Audio',
      icon: Music,
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      items: sortedItems.filter((it) => !it.isDir && getFileCategory(it.extension, false) === 'audio'),
    },
    {
      id: 'other',
      title: 'Berkas Lainnya',
      icon: FolderOpen,
      color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
      items: sortedItems.filter(
        (it) =>
          !it.isDir &&
          getFileCategory(it.extension, false) !== 'image' &&
          getFileCategory(it.extension, false) !== 'video' &&
          getFileCategory(it.extension, false) !== 'audio' &&
          getFileCategory(it.extension, false) !== 'document' &&
          !isOfficeOrPdf(it.extension)
      ),
    },
  ].filter((group) => group.items.length > 0);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const totalSize = items.reduce((acc, curr) => acc + (curr.isDir ? 0 : curr.size), 0);
  const isAllSelected = sortedItems.length > 0 && sortedItems.every((it) => selectedPaths.has(it.path));

  // Parent directory navigation
  const canGoUp = currentPath !== '/' && currentPath !== '';
  const handleGoUp = () => {
    const segments = currentPath.split('/').filter(Boolean);
    segments.pop();
    const parent = segments.length === 0 ? '/' : '/' + segments.join('/');
    onNavigate(parent);
  };

  // Helper to recursively extract files with relative paths from webkitGetAsEntry
  const scanDataTransferEntries = async (dataTransfer: DataTransfer): Promise<UploadItemWithPath[]> => {
    const results: UploadItemWithPath[] = [];
    const items = dataTransfer.items;

    if (items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === 'function') {
      const readEntriesPromise = (reader: any): Promise<any[]> => {
        return new Promise((resolve) => {
          reader.readEntries((entries: any[]) => resolve(entries || []), () => resolve([]));
        });
      };

      const traverse = async (entry: any, currentRelPath = ''): Promise<void> => {
        if (!entry) return;
        if (entry.isFile) {
          const file = await new Promise<File | null>((res) => entry.file(res, () => res(null)));
          if (file) {
            results.push({
              file,
              relativePath: currentRelPath ? `${currentRelPath}/${file.name}` : file.name,
            });
          }
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          let allChildEntries: any[] = [];
          let batch: any[] = [];
          do {
            batch = await readEntriesPromise(dirReader);
            allChildEntries = allChildEntries.concat(batch);
          } while (batch.length > 0);

          const subDirPath = currentRelPath ? `${currentRelPath}/${entry.name}` : entry.name;
          for (const child of allChildEntries) {
            await traverse(child, subDirPath);
          }
        }
      };

      const entryPromises: Promise<void>[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = (items[i] as any).webkitGetAsEntry();
        if (entry) {
          entryPromises.push(traverse(entry, ''));
        }
      }
      await Promise.all(entryPromises);
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i];
        results.push({
          file,
          relativePath: (file as any).webkitRelativePath || file.name,
        });
      }
    }

    return results;
  };

  // Handle Drag & Drop over explorer background (Desktop Files / Folders)
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingDesktop(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDesktop(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDesktop(false);

    if (e.dataTransfer.types.includes('Files')) {
      const scanned = await scanDataTransferEntries(e.dataTransfer);
      if (scanned.length > 0) {
        onUploadFolderFiles(scanned);
      }
    }
  };

  // Internal Drag-and-Drop to move files/folders into another folder
  const handleDragStartItem = (item: NasItem, e: React.DragEvent) => {
    let pathsToMove: string[] = [];
    if (selectedPaths.has(item.path)) {
      pathsToMove = Array.from(selectedPaths);
    } else {
      pathsToMove = [item.path];
    }
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'internal-nas-move', paths: pathsToMove }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnFolder = (targetFolder: NasItem, e: React.DragEvent) => {
    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;

    try {
      const parsed = JSON.parse(rawData);
      if (parsed.type === 'internal-nas-move' && Array.isArray(parsed.paths)) {
        const itemsToMove = items.filter(
          (it) => parsed.paths.includes(it.path) && it.path !== targetFolder.path
        );
        if (itemsToMove.length > 0) {
          onMoveItemsToFolder(itemsToMove, targetFolder);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleItemClick = (it: NasItem) => {
    if (it.isDir) {
      onNavigate(it.path);
    } else if (isOfficeOrPdf(it.extension) && onEditDocument) {
      onEditDocument(it);
    } else {
      onPreview(it);
    }
  };

  // Render a list of items as grid
  const renderItemGrid = (itemList: NasItem[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
      {itemList.map((item) => (
        <FileCard
          key={item.path}
          item={item}
          isSelected={selectedPaths.has(item.path)}
          onToggleSelect={onToggleSelect}
          onDragStartItem={handleDragStartItem}
          onDropOnFolder={handleDropOnFolder}
          onOpen={handleItemClick}
          onPreview={onPreview}
          onEditDocument={onEditDocument}
          onDownload={onDownload}
          onRename={onRename}
          onDelete={onDelete}
          onCopy={onCopyItem}
          onMove={onMoveItem}
        />
      ))}
    </div>
  );

  // Render a list of items as table rows
  const renderItemList = (itemList: NasItem[]) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden flex flex-col">
      <div className="w-full overflow-x-auto touch-pan-y overscroll-x-contain custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[620px] sm:min-w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10 shadow-xs">
              <th className="py-3 pl-3 sm:pl-4 pr-1 w-8">
                <button
                  onClick={onSelectAll}
                  title={isAllSelected ? 'Batalkan pilihan' : 'Tandai semua'}
                  className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-blue-500"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="py-3 px-3">Nama</th>
              <th className="py-3 px-2 sm:px-4">Ukuran</th>
              <th className="hidden md:table-cell py-3 px-4">Modifikasi</th>
              <th className="hidden sm:table-cell py-3 px-4">Tipe</th>
              <th className="py-3 px-3 sm:px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {itemList.map((item) => (
              <FileRow
                key={item.path}
                item={item}
                isSelected={selectedPaths.has(item.path)}
                onToggleSelect={onToggleSelect}
                onDragStartItem={handleDragStartItem}
                onDropOnFolder={handleDropOnFolder}
                onOpen={handleItemClick}
                onPreview={onPreview}
                onEditDocument={onEditDocument}
                onDownload={onDownload}
                onRename={onRename}
                onDelete={onDelete}
                onCopy={onCopyItem}
                onMove={onMoveItem}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-6 pb-40 sm:pb-32 md:pb-12 bg-slate-50 dark:bg-slate-950 flex flex-col custom-scrollbar touch-pan-y scroll-smooth"
    >
      {/* Desktop Drag & Drop Overlay */}
      {isDraggingDesktop && (
        <div className="absolute inset-4 z-40 bg-blue-600/90 rounded-2xl flex flex-col items-center justify-center text-white backdrop-blur-xs border-2 border-dashed border-white pointer-events-none animate-in fade-in">
          <UploadCloud className="w-16 h-16 animate-bounce mb-3" />
          <h3 className="text-xl font-semibold">Lepaskan Berkas atau Folder untuk Mengunggah</h3>
          <p className="text-sm text-blue-100 mt-1">
            Folder dan berkas akan otomatis diunggah dengan struktur aslinya ke <span className="font-mono">{currentPath}</span>
          </p>
        </div>
      )}

      {/* Sticky Category & Control Toolbar (Never covered when opening or scrolling media/cards) */}
      <div className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md pt-1 pb-3 -mt-3 sm:-mt-6 mb-3 sm:mb-4 border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        {/* Row 1: Nav & Item Stats */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            {canGoUp && (
              <button
                onClick={handleGoUp}
                title="Kembali ke folder sebelumnya"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs shrink-0"
              >
                <ArrowUp className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden sm:inline">Naik</span>
              </button>
            )}

            {sortedItems.length > 0 && (
              <button
                onClick={onSelectAll}
                title={isAllSelected ? 'Batalkan pilihan semua berkas' : 'Tandai semua berkas dalam folder ini'}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs shrink-0"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{isAllSelected ? 'Batal' : 'Tandai Semua'}</span>
              </button>
            )}

            <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
              <span>
                <strong className="text-slate-800 dark:text-slate-200 font-mono tabular-nums">{items.length}</strong> item
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">{formatBytes(totalSize)}</span>
              {searchQuery && (
                <>
                  <span>·</span>
                  <span className="text-blue-600 dark:text-blue-400 truncate">
                    {filteredItems.length} hasil "{searchQuery}"
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Media Shuffle Play Button if video/audio exists */}
          {items.some(
            (it) =>
              !it.isDir &&
              (getFileCategory(it.extension, false) === 'video' ||
                getFileCategory(it.extension, false) === 'audio')
          ) && (
            <button
              onClick={onShufflePlayFolder}
              title="Acak dan putar seluruh video atau musik di dalam folder ini"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Putar Acak</span>
              <span className="sm:hidden">Acak</span>
            </button>
          )}
        </div>

        {/* Row 2: Fixed "Kelompokkan" toggle + Horizontally Scrollable Category Pills */}
        <div className="flex items-center gap-2">
          {/* Kelompokkan Button - ALWAYS PINNED ON THE LEFT SO IT CAN NEVER BE COVERED */}
          <button
            onClick={() => setIsGroupedView(!isGroupedView)}
            title="Kelompokkan berkas secara otomatis berdasarkan jenis (Foto, Video, Dokumen, Musik, Folder)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 shadow-xs cursor-pointer ${
              isGroupedView
                ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500/30'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Kelompokkan</span>
            {isGroupedView && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />}
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 shrink-0 mx-0.5" />

          {/* Horizontally scrollable category pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                categoryFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs font-semibold'
                  : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <span>Semua</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                categoryFilter === 'all'
                  ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                {searchFilteredItems.length}
              </span>
            </button>

            {imageCount > 0 && (
              <button
                onClick={() => setCategoryFilter('image')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  categoryFilter === 'image'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                <span>Foto ({imageCount})</span>
              </button>
            )}

            {videoCount > 0 && (
              <button
                onClick={() => setCategoryFilter('video')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  categoryFilter === 'video'
                    ? 'bg-purple-600 text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <VideoIcon className="w-3.5 h-3.5 text-purple-500" />
                <span>Video ({videoCount})</span>
              </button>
            )}

            {docCount > 0 && (
              <button
                onClick={() => setCategoryFilter('document')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  categoryFilter === 'document'
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                <span>Dokumen ({docCount})</span>
              </button>
            )}

            {audioCount > 0 && (
              <button
                onClick={() => setCategoryFilter('audio')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  categoryFilter === 'audio'
                    ? 'bg-rose-600 text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Music className="w-3.5 h-3.5 text-rose-500" />
                <span>Musik ({audioCount})</span>
              </button>
            )}

            {folderCount > 0 && (
              <button
                onClick={() => setCategoryFilter('folder')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  categoryFilter === 'folder'
                    ? 'bg-amber-600 text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                <span>Folder ({folderCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>



      {/* Clipboard Action Banner */}
      {clipboard && clipboard.items && clipboard.items.length > 0 && (
        <div className="mb-6 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              {clipboard.action === 'copy' ? <Copy className="w-4 h-4" /> : <FolderInput className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                  clipboard.action === 'copy'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                }`}>
                  {clipboard.action === 'copy' ? 'Salin (Copy)' : 'Pindahkan (Move)'}
                </span>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate max-w-xs md:max-w-md">
                  {clipboard.items.length === 1
                    ? clipboard.items[0].name
                    : `${clipboard.items.length} berkas/folder terpilih`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Siap ditempel ke folder: <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">{currentPath}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onPaste}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Tempel {clipboard.items.length > 1 ? `(${clipboard.items.length})` : ''} di Sini</span>
            </button>
            <button
              onClick={onClearClipboard}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              title="Batalkan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 animate-pulse"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 mb-3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Populated State */}
      {!isLoading && sortedItems.length > 0 && (
        <>
          {isGroupedView ? (
            /* Grouped View by Category Sections */
            <div className="space-y-6">
              {groupedSections.map((section) => {
                const isCollapsed = !!collapsedGroups[section.id];
                const Icon = section.icon;

                return (
                  <div
                    key={section.id}
                    className="bg-white/60 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 sm:p-4 shadow-xs"
                  >
                    {/* Section Header */}
                    <button
                      onClick={() => toggleGroupCollapse(section.id)}
                      className="w-full flex items-center justify-between text-left py-1 mb-3 group focus:outline-hidden"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg border ${section.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {section.title}
                        </h4>
                        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {section.items.length} item
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">
                        <span className="text-xs hidden sm:inline">
                          {isCollapsed ? 'Tampilkan' : 'Sembunyikan'}
                        </span>
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {/* Section Content */}
                    {!isCollapsed && (
                      <div className="pt-1">
                        {viewMode === 'grid' ? renderItemGrid(section.items) : renderItemList(section.items)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Standard Grid or List View */
            viewMode === 'grid' ? renderItemGrid(sortedItems) : renderItemList(sortedItems)
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && sortedItems.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 mb-4">
            <FolderOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            {searchQuery
              ? 'Tidak Ada Berkas Ditemukan'
              : categoryFilter !== 'all'
              ? `Tidak Ada Berkas Kategori Ini`
              : 'Folder Ini Kosong'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-6">
            {searchQuery
              ? `Tidak ditemukan berkas yang cocok dengan "${searchQuery}". Coba kata kunci lain.`
              : categoryFilter !== 'all'
              ? 'Belum ada berkas dengan kategori ini dalam folder saat ini. Pilih kategori lain atau "Semua".'
              : 'Belum ada berkas di dalam folder ini. Anda dapat mengunggah berkas atau folder sekarang, atau drag & drop folder langsung ke sini.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {categoryFilter !== 'all' && (
              <button
                onClick={() => setCategoryFilter('all')}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
              >
                Tampilkan Semua Berkas
              </button>
            )}
            <button
              onClick={onNewFolder}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Buat Folder
            </button>
            <label className="cursor-pointer px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
              <span>Unggah Berkas</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && onUploadFiles(e.target.files)}
              />
            </label>
          </div>
        </div>
      )}

      {/* Floating Multi-Select Action Bar */}
      {selectedPaths.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white border border-slate-700 rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 max-w-lg">
          <div className="flex items-center gap-2 text-xs font-semibold border-r border-slate-700 pr-3 text-slate-200">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
              {selectedPaths.size}
            </span>
            <span>Dipilih</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={onBatchCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors"
              title="Salin semua item yang ditandai"
            >
              <Copy className="w-3.5 h-3.5 text-blue-400" />
              <span>Salin</span>
            </button>
            <button
              onClick={onBatchMove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors"
              title="Pindahkan semua item yang ditandai"
            >
              <FolderInput className="w-3.5 h-3.5 text-purple-400" />
              <span>Pindahkan</span>
            </button>
            <button
              onClick={onBatchDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 border border-rose-800/50 transition-colors"
              title="Hapus semua item yang ditandai"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Hapus</span>
            </button>
          </div>

          <button
            onClick={onClearSelection}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Batalkan pilihan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Quick Scroll Controls */}
      <div className="fixed bottom-24 sm:bottom-8 right-3 sm:right-6 z-30 flex flex-col items-end gap-1.5 pointer-events-none">
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          {showScrollTop && (
            <button
              onClick={handleScrollToTop}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-900/90 dark:bg-slate-800/95 hover:bg-blue-600 text-white text-xs font-semibold border border-slate-700/80 backdrop-blur-md shadow-xl transition-all active:scale-95 cursor-pointer animate-in fade-in slide-in-from-bottom-2"
              title="Geser ke atas"
            >
              <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
              <span>Ke Atas</span>
            </button>
          )}

          {sortedItems.length > 8 && !showScrollTop && (
            <button
              onClick={handleScrollToBottom}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-900/90 dark:bg-slate-800/95 hover:bg-blue-600 text-white text-xs font-semibold border border-slate-700/80 backdrop-blur-md shadow-xl transition-all active:scale-95 cursor-pointer animate-in fade-in"
              title="Geser ke bawah"
            >
              <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
              <span>Ke Bawah</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
