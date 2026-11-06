import React, { useState } from 'react';
import {
  Download,
  Eye,
  Trash2,
  Edit2,
  Copy,
  Check,
  FolderInput,
  CheckSquare,
  Square,
  FileEdit,
} from 'lucide-react';
import { NasItem } from '../types';
import { formatBytes, formatDate, getFileCategory, isOfficeOrPdf } from '../utils/format';
import { FileIcon } from './FileIcon';
import { MediaThumbnail } from './MediaThumbnail';

interface FileRowProps {
  item: NasItem;
  isSelected?: boolean;
  onToggleSelect?: (item: NasItem, e: React.MouseEvent) => void;
  onOpen: (item: NasItem) => void;
  onPreview: (item: NasItem) => void;
  onDownload: (item: NasItem) => void;
  onRename: (item: NasItem) => void;
  onDelete: (item: NasItem) => void;
  onCopy?: (item: NasItem) => void;
  onMove?: (item: NasItem) => void;
  onDragStartItem?: (item: NasItem, e: React.DragEvent) => void;
  onDropOnFolder?: (targetFolder: NasItem, e: React.DragEvent) => void;
  onEditDocument?: (item: NasItem) => void;
}

export const FileRow: React.FC<FileRowProps> = ({
  item,
  isSelected = false,
  onToggleSelect,
  onOpen,
  onPreview,
  onDownload,
  onRename,
  onDelete,
  onCopy,
  onMove,
  onDragStartItem,
  onDropOnFolder,
  onEditDocument,
}) => {
  const [copied, setCopied] = useState(false);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);
  const category = getFileCategory(item.extension, item.isDir);
  const isMedia = category === 'image' || category === 'video';

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRowDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', item.path);
    if (onDragStartItem) {
      onDragStartItem(item, e);
    }
  };

  const handleRowDragOver = (e: React.DragEvent) => {
    if (!item.isDir) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOverTarget(true);
  };

  const handleRowDragLeave = (e: React.DragEvent) => {
    if (!item.isDir) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
  };

  const handleRowDrop = (e: React.DragEvent) => {
    if (!item.isDir) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
    onDropOnFolder?.(item, e);
  };

  // Only enable HTML5 draggable on mouse pointer devices so touch swipe scrolling is not blocked on phones/tablets
  const isMousePointer =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(pointer: fine)').matches;

  return (
    <tr
      draggable={isMousePointer}
      onDragStart={handleRowDragStart}
      onDragOver={handleRowDragOver}
      onDragLeave={handleRowDragLeave}
      onDrop={handleRowDrop}
      onClick={() => onOpen(item)}
      style={{ touchAction: 'pan-y' }}
      className={`group border-b border-slate-100 dark:border-slate-800/80 cursor-pointer transition-colors text-sm select-none touch-pan-y ${
        isSelected
          ? 'bg-blue-50/90 dark:bg-blue-950/60'
          : isDragOverTarget
          ? 'bg-emerald-100/80 dark:bg-emerald-950/60 ring-2 ring-emerald-500'
          : 'hover:bg-blue-50/40 dark:hover:bg-slate-800/60'
      }`}
    >
      {/* Checkbox column */}
      <td className="py-2.5 pl-3 sm:pl-4 pr-1 w-8">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(item, e);
          }}
          title={isSelected ? 'Batalkan pilihan' : 'Tandai berkas ini'}
          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
            isSelected
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-300 dark:text-slate-600 hover:text-blue-500'
          }`}
        >
          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>
      </td>

      {/* Name and Icon / Thumbnail */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-3">
          {isMedia ? (
            <div className="w-9 h-9 rounded-md overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
              <MediaThumbnail
                filePath={item.path}
                category={category}
                extension={item.extension}
                isDir={item.isDir}
                className="w-full h-full"
                mode="row"
              />
            </div>
          ) : (
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <FileIcon extension={item.extension} isDir={item.isDir} className="w-5 h-5" />
            </div>
          )}

          <span
            title={item.name}
            className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate max-w-xs md:max-w-md lg:max-w-lg transition-colors"
          >
            {item.name}
          </span>
        </div>
      </td>

      {/* Size */}
      <td className="py-2.5 px-2 sm:px-4 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
        {item.isDir ? '—' : formatBytes(item.size)}
      </td>

      {/* Modified date */}
      <td className="hidden md:table-cell py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
        {formatDate(item.modified)}
      </td>

      {/* Type */}
      <td className="hidden sm:table-cell py-2.5 px-4 text-xs font-mono text-slate-400 uppercase whitespace-nowrap">
        {item.isDir ? 'Folder' : item.extension?.replace('.', '') || 'Berkas'}
      </td>

      {/* Actions */}
      <td className="py-2.5 px-4 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {!item.isDir && (
            <button
              onClick={() => onPreview(item)}
              title="Pratinjau"
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}

          {onEditDocument && isOfficeOrPdf(item.extension) && (
            <button
              onClick={() => onEditDocument(item)}
              title={item.extension.toLowerCase().includes('pdf') ? 'Buka & Edit PDF' : 'Buka & Edit Office'}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <FileEdit className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onDownload(item)}
            title={item.isDir ? 'Unduh sebagai ZIP' : 'Unduh'}
            className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          {onCopy && (
            <button
              onClick={() => onCopy(item)}
              title="Salin (Copy)"
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}

          {onMove && (
            <button
              onClick={() => onMove(item)}
              title="Pindahkan (Move)"
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              <FolderInput className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleCopyPath}
            title="Salin Path"
            className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
          </button>

          <button
            onClick={() => onRename(item)}
            title="Ganti Nama"
            className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDelete(item)}
            title="Hapus"
            className="p-1.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};
