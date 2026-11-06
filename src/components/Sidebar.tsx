import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  FolderSync,
  Globe,
  Folder,
  ExternalLink,
  X,
  Lock,
  History,
} from 'lucide-react';
import { NasStatus, SyncState } from '../types';
import { api } from '../services/api';
import { formatBytes } from '../utils/format';

interface SidebarProps {
  activeTab: 'files' | 'sync' | 'portal';
  setActiveTab: (tab: 'files' | 'sync' | 'portal') => void;
  nasStatus: NasStatus | null;
  syncState: SyncState | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  isSyncing: boolean;
  onTriggerSync: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  onLockApp?: () => void;
  onOpenActivityHistory?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  nasStatus,
  syncState,
  onNavigate,
  isSyncing,
  onTriggerSync,
  isMobileOpen = false,
  onMobileClose,
  onLockApp,
  onOpenActivityHistory,
}) => {
  const [nasUsedBytes, setNasUsedBytes] = useState<number>(395608850432);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const stats = await api.getNasStorageStats();
        if (isMounted && stats && typeof stats.usedBytes === 'number') {
          setNasUsedBytes(stats.usedBytes);
        }
      } catch {
        // keep current
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isSyncing]);

  const handleNavClick = (tab: 'files' | 'sync' | 'portal', path?: string) => {
    setActiveTab(tab);
    if (path) onNavigate(path);
    if (onMobileClose) onMobileClose();
  };

  const renderContent = () => (
    <div className="flex flex-col h-full text-slate-300">
      {/* Brand & Connection Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-white text-base tracking-tight truncate">
                CloudKu @joko92m
              </h1>
              <span className="inline-flex items-center text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">Cloud Pribadi @joko92m</p>
          </div>
        </div>
        {/* Mobile close button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Server & User quick tag */}
      <div className="p-4 pb-2">
        <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Server NAS</span>
            <span className="text-blue-400 font-mono text-[11px] truncate max-w-[130px]">
              nas.e1cloud.biz.id
            </span>
          </div>
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-700/40">
            <span className="text-slate-400">Pengguna</span>
            <span className="text-slate-200 font-medium font-mono text-[11px]">admin</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-slate-400">Status Latensi</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
              {nasStatus?.authenticated ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400">{nasStatus.latencyMs}ms</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-amber-400">Menghubungkan...</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Nav Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase px-3 mb-2">
            Penyimpanan Home Server
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => handleNavClick('files', '/')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'files'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Folder className="w-4 h-4 shrink-0 text-blue-400" />
              <span className="truncate">Home Server</span>
            </button>
          </nav>
        </div>

        {/* Sync & Portal Tools */}
        <div>
          <div className="text-[11px] font-medium tracking-wider text-slate-400 uppercase px-3 mb-2">
            Konektivitas &amp; Kapasitas
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => handleNavClick('sync')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'sync'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <FolderSync className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin text-blue-300' : ''}`} />
                <span className="truncate">Sisa Kapasitas &amp; Sinkron</span>
              </div>
              <span className="text-[10px] font-mono tabular-nums text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                Live
              </span>
            </button>

            <button
              onClick={() => handleNavClick('portal')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'portal'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0 text-cyan-400" />
              <span className="truncate">Portal Langsung NAS</span>
            </button>

            {onOpenActivityHistory && (
              <button
                onClick={() => {
                  onOpenActivityHistory();
                  if (onMobileClose) onMobileClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-slate-300 hover:bg-slate-800/80 hover:text-white cursor-pointer"
              >
                <div className="flex items-center gap-3 truncate">
                  <History className="w-4 h-4 shrink-0 text-indigo-400" />
                  <span className="truncate">Riwayat Aktivitas</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                  Cloud
                </span>
              </button>
            )}
          </nav>
        </div>

        {/* Storage Capacity Quick Overview */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Kapasitas Penyimpanan</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate text-slate-300 font-medium">Home Server</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-0.5">
              <span className="text-[11px] text-slate-400">Total Terpakai:</span>
              <span className="text-xs font-bold font-mono text-white tracking-tight">
                {formatBytes(nasUsedBytes)}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleNavClick('sync')}
            className="w-full mt-2 py-1.5 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-medium text-blue-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>Lihat Rincian Kapasitas</span>
          </button>
        </div>
      </div>

      {/* Footer Credentials & Lock Button */}
      <div className="p-3 border-t border-slate-800 text-xs text-slate-400 bg-slate-900/60 space-y-2">
        {onLockApp && (
          <button
            onClick={() => {
              if (onMobileClose) onMobileClose();
              onLockApp();
            }}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 border border-slate-700/60 hover:border-rose-800/60 text-slate-300 text-xs font-semibold transition-all cursor-pointer shadow-xs"
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>Kunci Aplikasi Sekarang</span>
          </button>
        )}
        <a
          href="http://nas.e1cloud.biz.id:55582/files/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 transition-colors group"
        >
          <div className="truncate">
            <div className="text-[11px] text-slate-400">Akses Web Asli</div>
            <div className="text-xs font-medium text-white truncate">nas.e1cloud.biz.id:55582</div>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0 ml-2" />
        </a>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-72 bg-slate-900 border-r border-slate-800 flex-col shrink-0 text-slate-300 h-full">
        {renderContent()}
      </aside>
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-150">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onMobileClose}
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {renderContent()}
          </aside>
        </div>
      )}
    </>
  );
};
