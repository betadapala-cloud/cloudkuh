import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  FileArchive,
  Music,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { NasItem } from '../types';
import { formatBytes, formatDate, getFileCategory } from '../utils/format';
import { api } from '../services/api';
import { MediaThumbnail } from './MediaThumbnail';

interface FilePreviewModalProps {
  item: NasItem | null;
  allItems?: NasItem[];
  onSelectItem?: (item: NasItem) => void;
  onClose: () => void;
  onDownload: (item: NasItem) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  item,
  allItems = [],
  onSelectItem,
  onClose,
  onDownload,
}) => {
  if (!item) return null;

  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [naturalDim, setNaturalDim] = useState<{ width: number; height: number } | null>(null);

  const category = getFileCategory(item.extension, item.isDir);
  const rawUrl = api.getRawFileUrl(item.path);

  // Filter media items in the same folder for thumbnail filmstrip & previous/next buttons
  const mediaItems = allItems.filter((it) => {
    if (it.isDir) return false;
    const cat = getFileCategory(it.extension, false);
    return cat === 'image' || cat === 'video';
  });

  const currentIndex = mediaItems.findIndex((it) => it.path === item.path);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < mediaItems.length - 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPrev && onSelectItem) {
      setZoomLevel(1);
      setNaturalDim(null);
      onSelectItem(mediaItems[currentIndex - 1]);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasNext && onSelectItem) {
      setZoomLevel(1);
      setNaturalDim(null);
      onSelectItem(mediaItems[currentIndex + 1]);
    }
  };

  // Keyboard navigation (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev && onSelectItem) {
        setZoomLevel(1);
        setNaturalDim(null);
        onSelectItem(mediaItems[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && hasNext && onSelectItem) {
        setZoomLevel(1);
        setNaturalDim(null);
        onSelectItem(mediaItems[currentIndex + 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, currentIndex, mediaItems, onSelectItem, onClose]);

  // Load text content for code/plain documents
  useEffect(() => {
    setZoomLevel(1);
    setNaturalDim(null);
    setTextContent(null);

    if (category === 'code' || category === 'document') {
      const ext = item.extension.toLowerCase();
      if (['txt', 'log', 'json', 'md', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'sh', 'yml', 'yaml'].some(e => ext.includes(e))) {
        setLoadingText(true);
        fetch(rawUrl)
          .then((res) => res.text())
          .then((text) => {
            setTextContent(text);
            setLoadingText(false);
          })
          .catch(() => {
            setTextContent('Gagal memuat isi berkas');
            setLoadingText(false);
          });
      }
    }
  }, [item.path, category, rawUrl]);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(item.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none"
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 bg-slate-50 dark:bg-slate-900/90">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {item.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span className="font-mono tabular-nums">{formatBytes(item.size)}</span>
              {naturalDim && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-blue-500">
                    {naturalDim.width} × {naturalDim.height} px
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{formatDate(item.modified)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono truncate max-w-xs">{item.path}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {category === 'image' && (
              <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800 p-1 rounded-lg mr-2">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  title="Perkecil"
                  className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] px-1 text-slate-700 dark:text-slate-300">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  title="Perbesar"
                  className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={handleCopyPath}
              title="Salin Path Berkas"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={() => onDownload(item)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Unduh</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Preview Area with Nav Arrows */}
        <div className="relative flex-1 overflow-auto p-4 flex flex-col items-center justify-center min-h-[360px] max-h-[62vh] bg-slate-100 dark:bg-slate-950">
          {/* Previous Media Arrow */}
          {hasPrev && (
            <button
              onClick={handlePrev}
              title="Berkas Sebelumnya"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-transform hover:scale-110 shadow-lg"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next Media Arrow */}
          {hasNext && (
            <button
              onClick={handleNext}
              title="Berkas Selanjutnya"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-transform hover:scale-110 shadow-lg"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Image View */}
          {category === 'image' && (
            <div className="max-w-full max-h-full flex items-center justify-center overflow-auto p-2">
              <img
                src={rawUrl}
                alt={item.name}
                referrerPolicy="no-referrer"
                style={{ transform: `scale(${zoomLevel})` }}
                onLoad={(e) => {
                  const target = e.currentTarget;
                  setNaturalDim({ width: target.naturalWidth, height: target.naturalHeight });
                }}
                className="max-w-full max-h-[58vh] object-contain rounded-lg shadow-md transition-transform duration-150"
              />
            </div>
          )}

          {/* Video Player */}
          {category === 'video' && (
            <div className="w-full max-w-3xl flex flex-col items-center justify-center">
              <video
                controls
                autoPlay
                playsInline
                preload="metadata"
                controlsList="nodownload"
                src={rawUrl}
                className="w-full max-h-[58vh] rounded-xl shadow-lg bg-black object-contain"
              >
                Browser Anda tidak mendukung pemutar video HTML5.
              </video>
            </div>
          )}

          {/* Audio Player */}
          {category === 'audio' && (
            <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md text-center">
              <div className="w-16 h-16 rounded-full bg-pink-500/10 text-pink-500 mx-auto flex items-center justify-center mb-4">
                <Music className="w-8 h-8" />
              </div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 truncate">
                {item.name}
              </h4>
              <audio controls src={rawUrl} className="w-full">
                Browser Anda tidak mendukung audio HTML5.
              </audio>
            </div>
          )}

          {/* Code / Text Viewer */}
          {textContent !== null && (
            <div className="w-full h-full max-h-[58vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 overflow-auto">
              {loadingText ? (
                <div className="text-center py-10 text-xs text-slate-400">Memuat teks berkas...</div>
              ) : (
                <pre className="font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {textContent}
                </pre>
              )}
            </div>
          )}

          {/* Archive Info */}
          {category === 'archive' && (
            <div className="max-w-md text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-500 mx-auto flex items-center justify-center mb-4">
                <FileArchive className="w-8 h-8" />
              </div>
              <h4 className="font-semibold text-slate-900 dark:text-white text-base">
                Arsip Terkompresi ({item.extension.toUpperCase()})
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">
                Berkas arsip berukuran {formatBytes(item.size)}. Silakan unduh untuk mengekstrak isi berkas di perangkat Anda.
              </p>
              <button
                onClick={() => onDownload(item)}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Unduh Arsip Sekarang
              </button>
            </div>
          )}

          {category !== 'image' &&
            category !== 'video' &&
            category !== 'audio' &&
            category !== 'archive' &&
            textContent === null && (
              <div className="max-w-md text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 mx-auto flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8" />
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-white text-base">
                  {item.name}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">
                  Pratinjau langsung tidak tersedia untuk format ini. Anda dapat mengunduh berkas langsung ke komputer atau ponsel.
                </p>
                <button
                  onClick={() => onDownload(item)}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Unduh Berkas ({formatBytes(item.size)})
                </button>
              </div>
            )}
        </div>

        {/* Bottom Thumbnail Strip for Photos & Videos in Current Directory */}
        {mediaItems.length > 1 && onSelectItem && (
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 overflow-hidden shrink-0">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
              <span>Thumbnail Berkas Multimedia di Folder Ini ({currentIndex + 1} dari {mediaItems.length})</span>
              <span className="font-mono text-[10px]">Gunakan tombol panah ← / → untuk navigasi</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {mediaItems.map((med) => {
                const isSelected = med.path === item.path;
                const medCat = getFileCategory(med.extension, false);
                return (
                  <button
                    key={med.path}
                    onClick={() => {
                      setZoomLevel(1);
                      setNaturalDim(null);
                      onSelectItem(med);
                    }}
                    title={med.name}
                    className={`relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/40 scale-105 shadow-md'
                        : 'border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-400'
                    }`}
                  >
                    <MediaThumbnail
                      filePath={med.path}
                      category={medCat}
                      extension={med.extension}
                      isDir={false}
                      className="w-full h-full"
                      mode="row"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
