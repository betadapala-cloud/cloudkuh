import React, { useState } from 'react';
import {
  Download,
  Eye,
  MoreVertical,
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

interface FileCardProps {
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

export const FileCard: React.FC<FileCardProps> = ({
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
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);

  const category = getFileCategory(item.extension, item.isDir);
  const isMedia = category === 'image' || category === 'video';

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowMenu(false);
  };

  const handleCardDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', item.path);
    if (onDragStartItem) {
      onDragStartItem(item, e);
    }
  };

  const handleCardDragOver = (e: React.DragEvent) => {
    if (!item.isDir) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOverTarget(true);
  };

  const handleCardDragLeave = (e: React.DragEvent) => {
    if (!item.isDir) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
  };

  const handleCardDrop = (e: React.DragEvent) => {
    if (!item.isDir) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
    onDropOnFolder?.(item, e);
  };

  return (
    <div
      draggable={true}
      onDragStart={handleCardDragStart}
      onDragOver={handleCardDragOver}
      onDragLeave={handleCardDragLeave}
      onDrop={handleCardDrop}
      onClick={() => onOpen(item)}
      className={`group relative rounded-xl p-3.5 transition-all duration-200 cursor-pointer flex flex-col justify-between border hover:shadow-md select-none ${
        isSelected
          ? 'ring-2 ring-blue-500 bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500'
          : isDragOverTarget
          ? 'ring-2 ring-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50 scale-[1.02] border-emerald-500 shadow-lg'
          : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80'
      }`}
    >
      {/* Top-left Multi-Select Checkbox */}
      <div
        className={`absolute top-2 left-2 z-20 transition-opacity ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(item, e);
          }}
          title={isSelected ? 'Batalkan pilihan' : 'Tandai berkas ini'}
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all shadow-xs ${
            isSelected
              ? 'bg-blue-600 text-white'
              : 'bg-white/95 dark:bg-slate-800/95 text-slate-400 hover:text-blue-600 border border-slate-300 dark:border-slate-600 backdrop-blur-xs'
          }`}
        >
          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>
      </div>

      {/* Media Thumbnail Container (Image / Video) */}
      {isMedia ? (
        <div className="relative mb-3 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700/60 aspect-video w-full bg-slate-900">
          <MediaThumbnail
            filePath={item.path}
            category={category}
            extension={item.extension}
            isDir={item.isDir}
            className="w-full h-full"
            mode="card"
          />

          {/* Top-right menu trigger on thumbnail */}
          <div className="absolute top-1.5 right-1.5 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded-md bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Top section for standard files & folders */
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 group-hover:scale-105 transition-transform ml-7">
            <FileIcon extension={item.extension} isDir={item.isDir} className="w-8 h-8" />
          </div>

          {/* Dropdown Menu Trigger */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Menu Popover */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 top-10 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 z-30 text-xs"
          >
            {!item.isDir && (
              <>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onPreview(item);
                  }}
                  className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  Pratinjau
                </button>
                {onEditDocument && isOfficeOrPdf(item.extension) && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEditDocument(item);
                    }}
                    className="w-full px-3 py-1.5 text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-2 font-medium"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    {item.extension.toLowerCase().includes('pdf') ? 'Buka & Edit PDF' : 'Buka & Edit Office'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDownload(item);
                  }}
                  className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  Unduh Berkas
                </button>
              </>
            )}

            {item.isDir && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDownload(item);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                Unduh Folder (.ZIP)
              </button>
            )}

            {onCopy && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  onCopy(item);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5 text-blue-500" />
                Salin (Copy)
              </button>
            )}

            {onMove && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  onMove(item);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <FolderInput className="w-3.5 h-3.5 text-purple-500" />
                Pindahkan (Move)
              </button>
            )}

            <button
              onClick={handleCopyPath}
              className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              Salin Path NAS
            </button>

            <button
              onClick={() => {
                setShowMenu(false);
                onRename(item);
              }}
              className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <Edit2 className="w-3.5 h-3.5 text-amber-500" />
              Ganti Nama
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-slate-700" />

            <button
              onClick={() => {
                setShowMenu(false);
                onDelete(item);
              }}
              className="w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus
            </button>
          </div>
        </>
      )}

      {/* Middle: Title & Metadata */}
      <div className="mb-3">
        <h3
          title={item.name}
          className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
        >
          {item.name}
        </h3>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span className="font-mono tabular-nums">{item.isDir ? 'Folder' : formatBytes(item.size)}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{formatDate(item.modified)}</span>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 uppercase font-mono tracking-wider">
          {item.isDir ? 'DIR' : item.extension || 'FILE'}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!item.isDir && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(item);
              }}
              title="Pratinjau"
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-blue-600 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(item);
            }}
            title="Unduh"
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-emerald-600 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
