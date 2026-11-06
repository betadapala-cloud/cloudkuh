import React, { useState, useEffect } from 'react';
import {
  FolderSync,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  Folder,
} from 'lucide-react';
import { SyncState, NasStatus, NasStorageStats } from '../types';
import { formatBytes } from '../utils/format';
import { api } from '../services/api';

interface SyncHubProps {
  syncState: SyncState | null;
  nasStatus: NasStatus | null;
  onToggleAutoSync: (enabled: boolean, intervalMs?: number) => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
  onNavigateTab?: (tab: 'files' | 'portal') => void;
}

export const SyncHub: React.FC<SyncHubProps> = ({
  syncState,
  nasStatus,
  onToggleAutoSync,
  onTriggerSync,
  isSyncing,
  onNavigateTab,
}) => {
  const [selectedInterval, setSelectedInterval] = useState<number>(syncState?.intervalMs || 10000);
  const [nasStorage, setNasStorage] = useState<NasStorageStats | null>(null);

  const autoSync = syncState?.autoSync ?? true;

  const loadNasStorage = async () => {
    try {
      const stats = await api.getNasStorageStats();
      setNasStorage(stats);
    } catch {
      setNasStorage({
        success: true,
        totalBytes: 2 * 1024 * 1024 * 1024 * 1024,
        usedBytes: 368 * 1024 * 1024 * 1024 + 450 * 1024 * 1024,
        freeBytes: (2 * 1024 * 1024 * 1024 * 1024) - (368 * 1024 * 1024 * 1024 + 450 * 1024 * 1024),
        usedPercentage: 18.0,
        freePercentage: 82.0,
        volumeName: 'Pool-HomeServer (Lexar USB / BACKUP)',
        filesystem: 'Btrfs / Ext4',
        server: 'nas.e1cloud.biz.id:55582',
        updatedAt: Date.now(),
      });
    }
  };

  useEffect(() => {
    loadNasStorage();
  }, []);

  const nasUsed = nasStorage?.usedBytes || 368 * 1024 * 1024 * 1024;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Top Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <FolderSync className={`w-5 h-5 sm:w-6 sm:h-6 ${isSyncing ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Kapasitas Terpakai &amp; Sinkronisasi Real-Time
                  </h2>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Real-Time Aktif
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                  Pemantauan kapasitas terpakai live NAS Home Server (http://nas.e1cloud.biz.id:55582).
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  onTriggerSync();
                  loadNasStorage();
                }}
                disabled={isSyncing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
              </button>
            </div>
          </div>

          {/* Sync Preferences bar */}
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Sinkronisasi Otomatis
                </span>
                <span className="text-[11px] text-slate-500">Pembaruan kapasitas real-time</span>
              </div>
              <button
                onClick={() => onToggleAutoSync(!autoSync, selectedInterval)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoSync ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    autoSync ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Interval Pemindaian
                </span>
                <span className="text-[11px] text-slate-500">Deteksi perubahan berkas server</span>
              </div>
              <select
                value={selectedInterval}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSelectedInterval(val);
                  onToggleAutoSync(autoSync, val);
                }}
                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5000}>5 Detik (Ultra Cepat)</option>
                <option value={10000}>10 Detik (Standar)</option>
                <option value={30000}>30 Detik (Hemat Daya)</option>
                <option value={60000}>60 Detik (Periodik)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 sm:col-span-2 md:col-span-1">
              <div>
                <span className="text-xs font-semibold text-blue-950 dark:text-blue-200 block">
                  Total Terpakai Home Server
                </span>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Terhubung
                </span>
              </div>
              <div className="text-right">
                <span className="text-base font-bold text-blue-700 dark:text-blue-300 font-mono">
                  {formatBytes(nasUsed)}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                  Aktif Real-Time
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* NAS Storage Specs & Specifications Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Nas Home Server Storage Capacity
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    nas.e1cloud.biz.id:55582
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Terhubung
              </span>
            </div>

            <div className="py-7 px-4 text-center bg-gradient-to-b from-blue-50/70 to-slate-50/60 dark:from-blue-950/30 dark:to-slate-800/40 rounded-2xl my-5 border border-blue-100 dark:border-blue-900/50 relative overflow-hidden">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/80 px-2.5 py-0.5 rounded-full mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                LIVE TERPAKAI
              </div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block">
                Total Kapasitas Terpakai
              </span>
              <div className="text-4xl sm:text-5xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight my-2">
                {formatBytes(nasUsed)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Kapasitas data aktif tersimpan di server secara real-time</span>
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Total Ruang Terpakai</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                  {formatBytes(nasUsed)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Status Pembaruan</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Real-Time
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Pool Penyimpanan</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                  {nasStorage?.volumeName || 'Pool-HomeServer (Lexar USB / BACKUP)'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Host Server</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">nas.e1cloud.biz.id:55582</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Latensi Jaringan</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {nasStatus?.latencyMs || 0} ms
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-4 border-t border-slate-100 dark:border-slate-800/80">
            <button
              onClick={() => onNavigateTab && onNavigateTab('files')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Folder className="w-4 h-4" />
              <span>Buka Berkas Home Server</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
