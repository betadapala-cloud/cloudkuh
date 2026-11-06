import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
  Clock,
  Ban,
} from 'lucide-react';
import { formatBytes } from '../utils/format';

export interface UploadTask {
  id: string;
  name: string;
  relativePath?: string;
  size: number;
  loaded: number;
  percentage: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'cancelled' | 'error';
  error?: string;
}

interface UploadProgressModalProps {
  tasks: UploadTask[];
  onDismiss: () => void;
  onClearCompleted: () => void;
  onPauseTask?: (taskId: string) => void;
  onResumeTask?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onPauseAll?: () => void;
  onResumeAll?: () => void;
  onCancelAll?: () => void;
  onRetryTask?: (taskId: string) => void;
}

export const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
  tasks,
  onDismiss,
  onClearCompleted,
  onPauseTask,
  onResumeTask,
  onCancelTask,
  onPauseAll,
  onResumeAll,
  onCancelAll,
  onRetryTask,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const cancelledCount = tasks.filter((t) => t.status === 'cancelled').length;
  const errorCount = tasks.filter((t) => t.status === 'error').length;
  const isAllDone = tasks.every(
    (t) => t.status === 'completed' || t.status === 'cancelled' || t.status === 'error'
  );

  const hasUploading = tasks.some((t) => t.status === 'uploading');
  const hasPaused = tasks.some((t) => t.status === 'paused');
  const hasActive = tasks.some(
    (t) => t.status === 'uploading' || t.status === 'paused' || t.status === 'pending'
  );

  const totalBytes = tasks.reduce((acc, t) => acc + t.size, 0);
  const totalLoaded = tasks.reduce(
    (acc, t) => acc + (t.status === 'completed' ? t.size : t.loaded),
    0
  );
  const overallPercentage =
    totalBytes > 0 ? Math.min(100, Math.round((totalLoaded / totalBytes) * 100)) : 0;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300">
      {/* Header bar */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
              hasUploading
                ? 'bg-blue-600/30 border-blue-500/40 text-blue-400'
                : hasPaused
                ? 'bg-amber-600/30 border-amber-500/40 text-amber-400'
                : completedCount === tasks.length
                ? 'bg-emerald-600/30 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {hasUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            ) : hasPaused ? (
              <Pause className="w-4 h-4 text-amber-400" />
            ) : completedCount === tasks.length ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Ban className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold truncate">
              {hasUploading
                ? `Mengunggah ${tasks.length} berkas (${overallPercentage}%)`
                : hasPaused
                ? `Unggahan Dijeda (${overallPercentage}%)`
                : isAllDone
                ? `${completedCount} selesai${cancelledCount > 0 ? `, ${cancelledCount} batal` : ''}${
                    errorCount > 0 ? `, ${errorCount} gagal` : ''
                  }`
                : `Menyiapkan ${tasks.length} berkas...`}
            </h4>
            <p className="text-[10px] text-slate-400 font-mono tabular-nums">
              {formatBytes(totalLoaded)} dari {formatBytes(totalBytes)}
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Pause All / Resume All Button */}
          {hasActive && (
            <>
              {hasUploading ? (
                <button
                  type="button"
                  onClick={onPauseAll}
                  title="Jeda semua unggahan"
                  className="px-2 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Pause className="w-3 h-3" />
                  <span className="hidden sm:inline">Jeda Semua</span>
                </button>
              ) : hasPaused ? (
                <button
                  type="button"
                  onClick={onResumeAll}
                  title="Lanjutkan semua unggahan"
                  className="px-2 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  <span className="hidden sm:inline">Lanjutkan</span>
                </button>
              ) : null}

              {/* Cancel All Button */}
              <button
                type="button"
                onClick={onCancelAll}
                title="Batalkan semua unggahan aktif"
                className="p-1 rounded-md hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <Ban className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Minimize / Maximize */}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Perbesar' : 'Minimalkan'}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Dismiss (X) */}
          {isAllDone && (
            <button
              type="button"
              onClick={onDismiss}
              title="Tutup jendela"
              className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main overall progress bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ${
            completedCount === tasks.length
              ? 'bg-emerald-500'
              : hasPaused
              ? 'bg-amber-500'
              : hasUploading
              ? 'bg-blue-600 animate-pulse'
              : 'bg-slate-500'
          }`}
          style={{ width: `${overallPercentage}%` }}
        />
      </div>

      {/* Expanded list of files with individual controls */}
      {!isMinimized && (
        <div className="max-h-72 overflow-y-auto p-3 space-y-2.5 bg-slate-50 dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800/40">
          {tasks.map((task) => (
            <div key={task.id} className="pt-2.5 first:pt-0">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs font-medium truncate ${
                      task.status === 'cancelled'
                        ? 'text-slate-400 dark:text-slate-500 line-through'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                    title={task.relativePath || task.name}
                  >
                    {task.relativePath || task.name}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                    <span>
                      {formatBytes(task.loaded)} / {formatBytes(task.size)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        task.status === 'completed'
                          ? 'text-emerald-500 font-semibold'
                          : task.status === 'uploading'
                          ? 'text-blue-500 font-medium'
                          : task.status === 'paused'
                          ? 'text-amber-500 font-semibold'
                          : task.status === 'cancelled'
                          ? 'text-slate-400 font-medium'
                          : task.status === 'error'
                          ? 'text-rose-500 font-semibold'
                          : 'text-slate-400'
                      }
                    >
                      {task.status === 'completed'
                        ? 'Selesai 100%'
                        : task.status === 'uploading'
                        ? `${task.percentage}%`
                        : task.status === 'paused'
                        ? `Dijeda (${task.percentage}%)`
                        : task.status === 'cancelled'
                        ? 'Dibatalkan'
                        : task.status === 'error'
                        ? 'Gagal'
                        : 'Menunggu...'}
                    </span>
                  </div>
                </div>

                {/* Per-task Action Buttons */}
                <div className="shrink-0 flex items-center gap-1">
                  {/* Uploading: Pause button */}
                  {task.status === 'uploading' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onPauseTask?.(task.id)}
                        title="Jeda berkas ini"
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-amber-500 transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCancelTask?.(task.id)}
                        title="Batalkan berkas ini"
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-rose-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {/* Paused: Resume and Cancel buttons */}
                  {task.status === 'paused' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onResumeTask?.(task.id)}
                        title="Lanjutkan unggahan"
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-500 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCancelTask?.(task.id)}
                        title="Batalkan berkas ini"
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-rose-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {/* Pending: Cancel button */}
                  {task.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => onCancelTask?.(task.id)}
                      title="Batalkan dari antrean"
                      className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Completed icon */}
                  {task.status === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}

                  {/* Cancelled or Error: Retry button */}
                  {(task.status === 'cancelled' || task.status === 'error') && onRetryTask && (
                    <button
                      type="button"
                      onClick={() => onRetryTask(task.id)}
                      title="Ulangi unggahan ini"
                      className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-blue-500 transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar per file */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 rounded-full ${
                    task.status === 'completed'
                      ? 'bg-emerald-500'
                      : task.status === 'paused'
                      ? 'bg-amber-500'
                      : task.status === 'cancelled'
                      ? 'bg-slate-400'
                      : task.status === 'error'
                      ? 'bg-rose-500'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${task.percentage}%` }}
                />
              </div>

              {task.error && (
                <p className="text-[10px] text-rose-500 mt-1">{task.error}</p>
              )}
            </div>
          ))}

          {/* Bottom actions */}
          {isAllDone && (
            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={onClearCompleted}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                Bersihkan Riwayat
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
