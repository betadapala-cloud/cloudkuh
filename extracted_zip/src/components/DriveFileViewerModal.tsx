import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  HardDrive,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  FileSpreadsheet,
  Presentation,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ExternalLink,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Film,
  Music,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { DriveItem, downloadDriveFileBlob, getDriveAccessToken } from '../services/googleDrive';
import { formatBytes, formatDate } from '../utils/format';

interface DriveFileViewerModalProps {
  item: DriveItem | null;
  onClose: () => void;
  onTransferToNas?: (item: DriveItem) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const DriveFileViewerModal: React.FC<DriveFileViewerModalProps> = ({
  item,
  onClose,
  onTransferToNas,
  showToast,
}) => {
  if (!item) return null;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobData, setBlobData] = useState<Blob | null>(null);

  // Viewer modes
  const [activeTab, setActiveTab] = useState<'preview' | 'embedded'>('preview');

  // Image zoom state
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Spreadsheet state
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [sheetData, setSheetData] = useState<(string | number)[][]>([]);

  // Document state (DOCX / Text)
  const [docHtml, setDocHtml] = useState<string>('');
  const [textContent, setTextContent] = useState<string>('');
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const mime = (item.mimeType || '').toLowerCase();
  const ext = item.name.split('.').pop()?.toLowerCase() || '';

  const isImage = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);
  const isPdf = mime === 'application/pdf' || ext === 'pdf' || mime === 'application/vnd.google-apps.document';
  const isSpreadsheet =
    ['xlsx', 'xls', 'csv'].includes(ext) ||
    mime.includes('spreadsheet') ||
    mime === 'application/vnd.google-apps.spreadsheet';
  const isWordDoc =
    ['docx', 'doc', 'rtf'].includes(ext) ||
    mime.includes('wordprocessingml') ||
    mime === 'application/vnd.google-apps.document';
  const isPresentation =
    ['pptx', 'ppt'].includes(ext) ||
    mime.includes('presentation') ||
    mime === 'application/vnd.google-apps.presentation';
  const isText =
    mime.startsWith('text/') || ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'py'].includes(ext);

  // Embedded Google Drive preview URL (works seamlessly for all Google Drive files)
  const embeddedPreviewUrl = `https://drive.google.com/file/d/${item.id}/preview`;

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    const loadContent = async () => {
      setLoading(true);
      setError(null);
      setZoomLevel(1);
      setDocHtml('');
      setTextContent('');
      setSheetData([]);

      try {
        const blob = await downloadDriveFileBlob(item.id, item.mimeType);
        if (!active) return;
        setBlobData(blob);

        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);

        // Process based on type
        if (isSpreadsheet) {
          const arrayBuffer = await blob.arrayBuffer();
          const wb = XLSX.read(arrayBuffer, { type: 'array' });
          if (!active) return;
          setWorkbook(wb);
          setSheetNames(wb.SheetNames);
          if (wb.SheetNames.length > 0) {
            const firstSheet = wb.Sheets[wb.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, { header: 1 });
            setSheetData(jsonData);
          }
        } else if (isWordDoc && ext === 'docx') {
          const arrayBuffer = await blob.arrayBuffer();
          const res = await mammoth.convertToHtml({ arrayBuffer });
          if (!active) return;
          setDocHtml(res.value);
        } else if (isText) {
          const txt = await blob.text();
          if (!active) return;
          setTextContent(txt);
        }
      } catch (err: any) {
        console.warn('Direct blob load failed, falling back to embedded viewer:', err);
        if (!active) return;
        setError(err.message || 'Gagal memuat pratinjau langsung');
        setActiveTab('embedded');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadContent();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [item.id]);

  const handleSheetChange = (index: number) => {
    if (!workbook || !sheetNames[index]) return;
    setActiveSheetIndex(index);
    const sheet = workbook.Sheets[sheetNames[index]];
    const data = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });
    setSheetData(data);
  };

  const handleDownload = () => {
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (showToast) showToast(`Mengunduh "${item.name}"...`, 'info');
    } else {
      window.open(item.webViewLink || `https://drive.google.com/file/d/${item.id}/view`, '_blank');
    }
  };

  const handleCopyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
      if (showToast) showToast('Teks berhasil disalin ke papan klip', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              {isImage && <ZoomIn className="w-5 h-5 text-emerald-400" />}
              {isVideo && <Film className="w-5 h-5 text-rose-400" />}
              {isAudio && <Music className="w-5 h-5 text-purple-400" />}
              {isPdf && <FileText className="w-5 h-5 text-rose-400" />}
              {isSpreadsheet && <FileSpreadsheet className="w-5 h-5 text-emerald-400" />}
              {isWordDoc && <FileText className="w-5 h-5 text-blue-400" />}
              {isPresentation && <Presentation className="w-5 h-5 text-amber-400" />}
              {!isImage && !isVideo && !isAudio && !isPdf && !isSpreadsheet && !isWordDoc && !isPresentation && (
                <FileText className="w-5 h-5 text-slate-400" />
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md md:max-w-lg" title={item.name}>
                {item.name}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span className="font-mono text-cyan-400">Google Drive</span>
                <span>•</span>
                {item.size && <span>{formatBytes(parseInt(item.size, 10))}</span>}
                {item.modifiedTime && <span>• {formatDate(item.modifiedTime)}</span>}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* View Switcher: In-app vs Google Embedded Viewer */}
            <div className="hidden sm:flex items-center p-0.5 bg-slate-800 rounded-lg border border-slate-700 text-xs">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-blue-600 text-white font-medium shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tampilan Aplikasi
              </button>
              <button
                onClick={() => setActiveTab('embedded')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === 'embedded'
                    ? 'bg-blue-600 text-white font-medium shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pratinjau Drive
              </button>
            </div>

            {/* Transfer to NAS */}
            {onTransferToNas && (
              <button
                onClick={() => {
                  onTransferToNas(item);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all cursor-pointer"
                title="Pindahkan berkas ini ke Home Server NAS"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pindah ke NAS</span>
              </button>
            )}

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title="Unduh Berkas"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-950">
          {activeTab === 'embedded' ? (
            /* Official Google Drive Embedded Iframe Viewer */
            <div className="w-full h-full relative">
              <iframe
                src={embeddedPreviewUrl}
                title={item.name}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          ) : loading ? (
            /* Loading Spinner */
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-9 h-9 animate-spin text-blue-500" />
              <p className="text-sm font-medium">Memuat berkas dari Google Drive...</p>
              <p className="text-xs text-slate-500">Mengambil aliran data terenkripsi...</p>
            </div>
          ) : error ? (
            /* Error & Fallback to Embedded Drive Preview */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Pratinjau Drive Dialihkan</h3>
              <p className="text-xs text-slate-400 max-w-md mb-4">{error}</p>
              <button
                onClick={() => setActiveTab('embedded')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Buka via Pratinjau Google Drive</span>
              </button>
            </div>
          ) : isImage && blobUrl ? (
            /* 1. Photos / Images Viewer */
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 relative select-none">
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-700 rounded-xl backdrop-blur-md shadow-lg">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.2, z - 0.25))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Perkecil"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-300 px-1.5 min-w-[50px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(4, z + 0.25))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Perbesar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Ukuran Asli (100%)"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              <img
                src={blobUrl}
                alt={item.name}
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center' }}
                className="max-h-[80vh] max-w-full object-contain rounded-lg transition-transform duration-150 shadow-2xl"
              />
            </div>
          ) : isVideo && blobUrl ? (
            /* 2. Video Player */
            <div className="flex-1 flex flex-col items-center justify-center p-4 bg-black">
              <video
                ref={videoRef}
                src={blobUrl}
                controls
                autoPlay
                className="max-h-[75vh] w-auto max-w-full rounded-xl shadow-2xl border border-slate-800"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              >
                Browser Anda tidak mendukung tag video HTML5.
              </video>
            </div>
          ) : isAudio && blobUrl ? (
            /* 3. Audio Player */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 rounded-3xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-6 shadow-xl shadow-purple-500/10">
                <Music className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{item.name}</h3>
              <p className="text-xs text-slate-400 mb-6">Pemutar Audio Google Drive</p>

              <audio src={blobUrl} controls autoPlay className="w-full max-w-md rounded-xl shadow-lg" />
            </div>
          ) : isPdf && blobUrl ? (
            /* 4. PDF Viewer */
            <div className="w-full h-full relative">
              <object
                data={blobUrl}
                type="application/pdf"
                className="w-full h-full border-0"
              >
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <p className="text-sm text-slate-300 mb-3">
                    Pratinjau PDF tidak didukung langsung oleh browser Anda.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('embedded')}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
                    >
                      Buka Pratinjau Google Drive
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold"
                    >
                      Unduh PDF
                    </button>
                  </div>
                </div>
              </object>
            </div>
          ) : isSpreadsheet ? (
            /* 5. Spreadsheet Table Viewer (Excel / CSV / Google Sheets) */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Sheet tabs bar */}
              {sheetNames.length > 1 && (
                <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/60 flex items-center gap-2 overflow-x-auto shrink-0">
                  {sheetNames.map((name, idx) => (
                    <button
                      key={name}
                      onClick={() => handleSheetChange(idx)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        activeSheetIndex === idx
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}

              {/* Data Table */}
              <div className="flex-1 overflow-auto p-4">
                {sheetData.length > 0 ? (
                  <table className="w-full text-xs text-left border-collapse font-mono">
                    <tbody>
                      {sheetData.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={`border-b border-slate-800/80 hover:bg-slate-800/50 ${
                            rIdx === 0
                              ? 'bg-slate-900/90 font-semibold text-emerald-400 sticky top-0 shadow-xs'
                              : 'text-slate-300'
                          }`}
                        >
                          <td className="py-1.5 px-2.5 text-[10px] text-slate-600 border-r border-slate-800/80 select-none w-10 text-center">
                            {rIdx + 1}
                          </td>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="py-1.5 px-3 border-r border-slate-800/60 whitespace-nowrap">
                              {cell !== null && cell !== undefined ? String(cell) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-16 text-slate-500">Lembar kerja kosong atau tidak ada data</div>
                )}
              </div>
            </div>
          ) : isWordDoc && docHtml ? (
            /* 6. Word / Document Viewer (DOCX HTML rendered) */
            <div className="flex-1 overflow-auto p-6 sm:p-10 flex justify-center bg-slate-950">
              <div
                className="w-full max-w-3xl bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-2xl min-h-[80vh] prose prose-sm max-w-none font-serif leading-relaxed"
                dangerouslySetInnerHTML={{ __html: docHtml }}
              />
            </div>
          ) : isText && textContent ? (
            /* 7. Code / Text Viewer */
            <div className="flex-1 overflow-auto p-4 relative">
              <button
                onClick={handleCopyText}
                className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 text-xs shadow-md transition-colors"
                title="Salin semua teks"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Tersalin' : 'Salin'}</span>
              </button>
              <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {textContent}
              </pre>
            </div>
          ) : (
            /* Fallback generic Drive Preview */
            <div className="w-full h-full">
              <iframe
                src={embeddedPreviewUrl}
                title={item.name}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          )}
        </div>

        {/* Bottom Footer Info */}
        <div className="p-2.5 sm:p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="truncate">Penampil Berkas CloudKu Google Drive</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={item.webViewLink || `https://drive.google.com/file/d/${item.id}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-xs transition-colors"
            >
              <span>Buka di Google Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
