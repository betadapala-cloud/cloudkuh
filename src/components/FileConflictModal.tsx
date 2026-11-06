import React, { useState } from 'react';
import { AlertTriangle, HardDrive, Upload, Copy, Check, X, ArrowRight } from 'lucide-react';
import { NasItem, UploadItemWithPath } from '../types';
import { formatBytes, formatDate } from '../utils/format';

export interface ConflictInfo {
  uploadItem: UploadItemWithPath;
  existingItem: NasItem;
}

interface FileConflictModalProps {
  conflict: ConflictInfo;
  remainingConflictsCount: number;
  onResolve: (action: 'overwrite' | 'skip' | 'rename', applyToAll: boolean) => void;
  onCancelAll: () => void;
}

export const FileConflictModal: React.FC<FileConflictModalProps> = ({
  conflict,
  remainingConflictsCount,
  onResolve,
  onCancelAll,
}) => {
  const [applyToAll, setApplyToAll] = useState(false);

  const { uploadItem, existingItem } = conflict;
  const fileName = uploadItem.file.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Konflik Nama Berkas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Berkas dengan nama ini sudah ada di folder tujuan.
            </p>
          </div>
        </div>

        {/* Body & Comparison */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Nama berkas:</p>
            <p className="text-sm font-semibold font-mono text-slate-900 dark:text-slate-100 break-all">
              {fileName}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Existing File */}
            <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                <span>Ada di Penyimpanan NAS</span>
              </div>
              <div className="space-y-1 text-slate-500 dark:text-slate-400">
                <p>
                  Ukuran: <strong className="text-slate-700 dark:text-slate-200 font-mono">{formatBytes(existingItem.size)}</strong>
                </p>
                <p>
                  Waktu: <span className="text-slate-700 dark:text-slate-200">{formatDate(existingItem.modified)}</span>
                </p>
              </div>
            </div>

            {/* New Upload File */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
              <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 mb-2">
                <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Berkas Baru yang Diunggah</span>
              </div>
              <div className="space-y-1 text-slate-500 dark:text-slate-400">
                <p>
                  Ukuran: <strong className="text-blue-700 dark:text-blue-300 font-mono">{formatBytes(uploadItem.file.size)}</strong>
                </p>
                <p>
                  Waktu: <span className="text-blue-700 dark:text-blue-300">{formatDate(uploadItem.file.lastModified)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Apply to all conflicts checkbox */}
          {remainingConflictsCount > 1 && (
            <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
              <span>
                Terapkan pilihan ini untuk seluruh sisa berkas bernama sama ({remainingConflictsCount} berkas lagi)
              </span>
            </label>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={onCancelAll}
            className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Batalkan Unggah
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onResolve('skip', applyToAll)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors shadow-xs"
            >
              Lompati (Skip)
            </button>

            <button
              onClick={() => onResolve('rename', applyToAll)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-xs"
              title="Unggah dengan nama baru agar berkas lama tidak hilang"
            >
              Simpan Keduanya
            </button>

            <button
              onClick={() => onResolve('overwrite', applyToAll)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Timpa Berkas</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
