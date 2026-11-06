import React from 'react';
import {
  Search,
  Upload,
  FolderPlus,
  FolderUp,
  RefreshCw,
  LayoutGrid,
  List,
  ChevronRight,
  FolderSync,
  Home,
  Check,
  X,
  ClipboardPaste,
  Menu,
  Lock,
  ArrowUpDown,
  History,
} from 'lucide-react';
import { ClipboardItem } from '../types';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  sortBy: 'name' | 'size' | 'modified';
  setSortBy: (sort: 'name' | 'size' | 'modified') => void;
  sortAsc: boolean;
  setSortAsc: (asc: boolean) => void;
  onUploadClick: () => void;
  onUploadFolderClick?: () => void;
  onNewFolderClick: () => void;
  onRefresh: () => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
  isLoading: boolean;
  clipboard?: ClipboardItem | null;
  onPasteClick?: () => void;
  onToggleMobileSidebar?: () => void;
  onLockApp?: () => void;
  onOpenActivityHistory?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  onNavigate,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  sortAsc,
  setSortAsc,
  onUploadClick,
  onUploadFolderClick,
  onNewFolderClick,
  onRefresh,
  onTriggerSync,
  isSyncing,
  isLoading,
  clipboard,
  onPasteClick,
  onToggleMobileSidebar,
  onLockApp,
  onOpenActivityHistory,
}) => {
  // Parse path segments into clickable breadcrumb parts
  const rawSegments = currentPath.split('/').filter(Boolean);
  const breadcrumbItems = [
    { name: 'Root', path: '/' },
    ...rawSegments.map((segment, index) => {
      const segPath = '/' + rawSegments.slice(0, index + 1).join('/');
      return { name: segment, path: segPath };
    }),
  ];

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
      {/* Mobile Menu Hamburger + Breadcrumb Trail */}
      <div className="flex items-center min-w-0 flex-1 gap-1">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="p-1.5 -ml-1 mr-0.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden transition-colors shrink-0"
            title="Buka Menu Navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Zone 1: Breadcrumb Trail */}
        <nav aria-label="Breadcrumb" className="flex items-center min-w-0 flex-1 overflow-hidden">
          <ol className="flex items-center gap-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 overflow-x-auto no-scrollbar py-1">
            {breadcrumbItems.map((item, index) => {
              const isLast = index === breadcrumbItems.length - 1;
              return (
                <li key={item.path} className="flex items-center gap-1 shrink-0">
                  {index > 0 && <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />}
                  {isLast ? (
                    <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-[200px]">
                      {item.name === 'Root' ? (
                        <span className="flex items-center gap-1">
                          <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                          <span>Home Server</span>
                        </span>
                      ) : (
                        item.name
                      )}
                    </span>
                  ) : (
                    <button
                      onClick={() => onNavigate(item.path)}
                      className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors truncate max-w-[90px] sm:max-w-[160px] flex items-center gap-1"
                      title={item.name === 'Root' ? 'Home Server' : item.name}
                    >
                      {item.name === 'Root' ? (
                        <span className="flex items-center gap-1">
                          <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                          <span className="hidden sm:inline">Home Server</span>
                        </span>
                      ) : (
                        item.name
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* Zone 2: Search Input (Compact on Mobile) */}
      <div className="relative w-32 sm:w-60 md:w-72 shrink-0">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari..."
          className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Zone 3: Sorting & Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Sort selector (desktop only) */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={() => {
              if (sortBy === 'name') setSortAsc(!sortAsc);
              else {
                setSortBy('name');
                setSortAsc(true);
              }
            }}
            className={`px-2 py-1 rounded transition-colors ${
              sortBy === 'name'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-medium shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Nama {sortBy === 'name' && (sortAsc ? '↑' : '↓')}
          </button>
          <button
            onClick={() => {
              if (sortBy === 'size') setSortAsc(!sortAsc);
              else {
                setSortBy('size');
                setSortAsc(false);
              }
            }}
            className={`px-2 py-1 rounded transition-colors ${
              sortBy === 'size'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-medium shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Ukuran {sortBy === 'size' && (sortAsc ? '↑' : '↓')}
          </button>
          <button
            onClick={() => {
              if (sortBy === 'modified') setSortAsc(!sortAsc);
              else {
                setSortBy('modified');
                setSortAsc(false);
              }
            }}
            className={`px-2 py-1 rounded transition-colors ${
              sortBy === 'modified'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-medium shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Waktu {sortBy === 'modified' && (sortAsc ? '↑' : '↓')}
          </button>
        </div>

        {/* Mobile sort toggle button */}
        <button
          onClick={() => {
            if (sortBy === 'name') {
              if (sortAsc) setSortAsc(false);
              else {
                setSortBy('size');
                setSortAsc(false);
              }
            } else if (sortBy === 'size') {
              setSortBy('modified');
              setSortAsc(false);
            } else {
              setSortBy('name');
              setSortAsc(true);
            }
          }}
          title={`Urutkan: ${sortBy === 'name' ? 'Nama' : sortBy === 'size' ? 'Ukuran' : 'Waktu'} (${sortAsc ? 'Naik' : 'Turun'})`}
          className="lg:hidden flex items-center gap-1 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 shadow-xs"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[10px] font-medium hidden sm:inline">
            {sortBy === 'name' ? 'Nama' : sortBy === 'size' ? 'Ukuran' : 'Waktu'} {sortAsc ? '↑' : '↓'}
          </span>
        </button>

        {/* View mode toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setViewMode('grid')}
            title="Tampilan Grid"
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="Tampilan List"
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Segarkan Berkas"
          className="p-1.5 sm:p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
        </button>

        {/* Activity History Button (Cloud Firestore) */}
        {onOpenActivityHistory && (
          <button
            onClick={onOpenActivityHistory}
            title="Riwayat Aktivitas Cloud Firestore"
            className="p-1.5 sm:p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs relative"
          >
            <History className="w-4 h-4 text-blue-500" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        )}

        {/* Lock App Button */}
        {onLockApp && (
          <button
            onClick={onLockApp}
            title="Kunci Aplikasi"
            className="p-1.5 sm:p-2 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition-colors shadow-xs"
          >
            <Lock className="w-4 h-4" />
          </button>
        )}

        {/* Action Buttons */}
        {clipboard && clipboard.items && clipboard.items.length > 0 && onPasteClick && (
          <button
            onClick={onPasteClick}
            title={`Tempel ${
              clipboard.items.length === 1 ? clipboard.items[0].name : `${clipboard.items.length} item`
            } (${clipboard.action === 'copy' ? 'Salin' : 'Pindah'}) ke sini`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors whitespace-nowrap shrink-0 animate-pulse"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span className="hidden sm:inline">
              Tempel {clipboard.items.length > 1 ? `(${clipboard.items.length})` : ''}
            </span>
            <span className="sm:hidden">({clipboard.items.length})</span>
          </button>
        )}

        <button
          onClick={onNewFolderClick}
          title="Buat Folder Baru"
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <FolderPlus className="w-4 h-4 text-blue-500" />
          <span className="hidden sm:inline">Folder Baru</span>
        </button>

        {onUploadFolderClick && (
          <button
            onClick={onUploadFolderClick}
            title="Unggah satu folder lengkap beserta seluruh isinya ke NAS"
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium rounded-lg border border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap shrink-0"
          >
            <FolderUp className="w-4 h-4" />
            <span className="hidden sm:inline">Unggah Folder</span>
          </button>
        )}

        <button
          onClick={onUploadClick}
          title="Unggah berkas ke NAS (Mendukung berkas besar hingga 20 GB)"
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Unggah Berkas</span>
          <span className="sm:hidden">Unggah</span>
        </button>
      </div>
    </header>
  );
};
