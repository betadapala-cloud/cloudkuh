import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  HardDrive,
  RefreshCw,
  FolderPlus,
  Upload,
  Trash2,
  Edit2,
  ArrowRightLeft,
  Copy,
  Eye,
  FolderSync,
  CheckCircle2,
  Clock,
  Cloud,
} from 'lucide-react';
import {
  ActivityLog,
  fetchActivityLogsFromBrowser,
  clearActivityLogsFromBrowser,
} from '../services/browserStorage';

interface ActivityHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  const loadLogs = () => {
    setIsLoading(true);
    try {
      const data = fetchActivityLogsFromBrowser(50);
      setLogs(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    clearActivityLogsFromBrowser();
    setLogs([]);
    setConfirmClear(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      setConfirmClear(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getActionIcon = (type: ActivityLog['actionType']) => {
    switch (type) {
      case 'upload':
        return <Upload className="w-4 h-4 text-blue-500" />;
      case 'create_folder':
        return <FolderPlus className="w-4 h-4 text-emerald-500" />;
      case 'rename':
        return <Edit2 className="w-4 h-4 text-amber-500" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 text-rose-500" />;
      case 'move':
        return <ArrowRightLeft className="w-4 h-4 text-purple-500" />;
      case 'copy':
        return <Copy className="w-4 h-4 text-indigo-500" />;
      case 'transfer_drive':
        return <Cloud className="w-4 h-4 text-cyan-500" />;
      case 'preview':
        return <Eye className="w-4 h-4 text-slate-400" />;
      case 'sync':
        return <FolderSync className="w-4 h-4 text-emerald-400" />;
      default:
        return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Riwayat Aktivitas Browser
                </h3>
                <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Penyimpanan Browser
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Riwayat aktivitas disimpan langsung di penyimpanan browser perangkat Anda (localStorage)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {logs.length > 0 && !confirmClear && (
              <button
                onClick={() => setConfirmClear(true)}
                className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                title="Hapus riwayat aktivitas"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hapus</span>
              </button>
            )}

            {confirmClear && (
              <div className="flex items-center gap-1.5 animate-in fade-in">
                <button
                  onClick={handleClearHistory}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Ya, Hapus
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}

            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Segarkan Riwayat"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 custom-scrollbar">
          {isLoading && logs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-slate-400">Memuat riwayat dari penyimpanan browser...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
              <HardDrive className="w-10 h-10 mb-2 opacity-40 text-blue-400" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Belum ada riwayat aktivitas yang tersimpan
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Aktivitas seperti upload, buat folder, ganti nama, hapus berkas, atau transfer drive akan otomatis tersimpan di penyimpanan browser lokal.
              </p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700/60 transition-all flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  {getActionIcon(log.actionType)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {log.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(log.createdAt)}
                    </span>
                  </div>

                  {log.details && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 break-words">
                      {log.details}
                    </p>
                  )}

                  {log.path && (
                    <span className="inline-block text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded mt-1 truncate max-w-md">
                      {log.path}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Penyimpanan Browser Aktif ({logs.length} catatan)
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
