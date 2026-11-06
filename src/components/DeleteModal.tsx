import React, { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { NasItem } from '../types';

interface DeleteModalProps {
  item: NasItem | null;
  items?: NasItem[] | null;
  onClose: () => void;
  onConfirm: (target: NasItem | NasItem[]) => Promise<void>;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  item,
  items,
  onClose,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMultiple = Boolean(items && items.length > 0);
  const activeItems = isMultiple ? items! : item ? [item] : [];

  if (activeItems.length === 0) return null;

  const handleDelete = async () => {
    try {
      setLoading(true);
      setError(null);
      if (isMultiple) {
        await onConfirm(items!);
      } else {
        await onConfirm(item!);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
          {isMultiple
            ? `Hapus ${activeItems.length} Item Yang Ditandai?`
            : `Hapus ${item?.isDir ? 'Folder' : 'Berkas'} Ini?`}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
          {isMultiple ? (
            <>
              Tindakan ini akan menghapus{' '}
              <strong className="text-slate-800 dark:text-slate-200">{activeItems.length} berkas/folder</strong> terpilih
              secara permanen dari penyimpanan cloud NAS. Berkas yang dihapus tidak dapat dikembalikan.
            </>
          ) : (
            <>
              Tindakan ini akan menghapus{' '}
              <strong className="text-slate-800 dark:text-slate-200 font-mono">{item?.name}</strong> dari
              penyimpanan cloud NAS. Berkas yang dihapus tidak dapat dikembalikan.
            </>
          )}
        </p>

        {isMultiple && activeItems.length > 0 && (
          <div className="max-h-28 overflow-y-auto mb-4 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1 text-xs">
            {activeItems.slice(0, 5).map((it) => (
              <div key={it.path} className="truncate text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                • {it.name}
              </div>
            ))}
            {activeItems.length > 5 && (
              <div className="text-[10px] text-slate-400 italic">
                ... dan {activeItems.length - 5} item lainnya
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-rose-500 mb-4">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {loading ? 'Menghapus...' : isMultiple ? `Ya, Hapus Semua (${activeItems.length})` : 'Ya, Hapus'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
